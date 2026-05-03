import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { TenantContext } from './tenantContext.js'
import { createTenant, listMyTenants } from '../lib/tenantApi.js'
import {
  getStoredActiveTenantId,
  setStoredActiveTenantId,
  setRuntimeActiveTenantId,
} from '../lib/activeTenant.js'

function normalizeTenantRecord(item) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    role: item.role,
    membershipId: item.membershipId,
    membershipStatus: item.membershipStatus,
    ownerUserId: item.ownerUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function resolveNextActiveTenantId(tenants) {
  const storedTenantId = getStoredActiveTenantId()
  if (storedTenantId && tenants.some((tenant) => tenant.id === storedTenantId)) {
    return storedTenantId
  }

  setStoredActiveTenantId(null)

  if (tenants.length === 1) {
    return tenants[0].id
  }

  return null
}

export function TenantProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [tenants, setTenants] = useState([])
  const [activeTenantId, setActiveTenantIdState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setRuntimeActiveTenantId(activeTenantId)
  }, [activeTenantId])

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([])
      setActiveTenantIdState(null)
      setError(null)
      setLoading(false)
      setStoredActiveTenantId(null)
      setRuntimeActiveTenantId(null)
      return
    }

    let active = true

    async function loadTenants() {
      setLoading(true)
      setError(null)

      try {
        const records = await listMyTenants()
        if (!active) return

        const nextTenants = records.map(normalizeTenantRecord)
        const nextActiveTenantId = resolveNextActiveTenantId(nextTenants)

        setTenants(nextTenants)
        setActiveTenantIdState(nextActiveTenantId)

        if (nextActiveTenantId) {
          setStoredActiveTenantId(nextActiveTenantId)
        }
      } catch (loadError) {
        if (!active) return
        setTenants([])
        setActiveTenantIdState(null)
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar workspaces.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTenants()

    return () => {
      active = false
    }
  }, [isAuthenticated])

  async function refreshTenants() {
    if (!isAuthenticated) {
      setTenants([])
      setActiveTenantIdState(null)
      setError(null)
      return []
    }

    setLoading(true)
    setError(null)

    try {
      const records = await listMyTenants()
      const nextTenants = records.map(normalizeTenantRecord)
      const currentTenantStillAccessible = activeTenantId && nextTenants.some((tenant) => tenant.id === activeTenantId)
      const nextActiveTenantId = currentTenantStillAccessible
        ? activeTenantId
        : resolveNextActiveTenantId(nextTenants)

      setTenants(nextTenants)
      setActiveTenantIdState(nextActiveTenantId)
      setStoredActiveTenantId(nextActiveTenantId)
      return nextTenants
    } catch (loadError) {
      setTenants([])
      setActiveTenantIdState(null)
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar workspaces.')
      throw loadError
    } finally {
      setLoading(false)
    }
  }

  async function createWorkspace(data) {
    setError(null)
    const result = await createTenant(data)
    const nextTenants = await refreshTenants()
    const createdTenantId = result?.tenant?.id ?? null

    if (createdTenantId && nextTenants.some((tenant) => tenant.id === createdTenantId)) {
      setActiveTenantIdState(createdTenantId)
      setStoredActiveTenantId(createdTenantId)
    }

    return result
  }

  function setActiveTenant(nextTenantId) {
    if (!nextTenantId) {
      setActiveTenantIdState(null)
      setStoredActiveTenantId(null)
      return
    }

    const hasAccess = tenants.some((tenant) => tenant.id === nextTenantId)
    if (!hasAccess) {
      setError('O tenant selecionado nao pertence ao usuario autenticado.')
      return
    }

    setError(null)
    setActiveTenantIdState(nextTenantId)
    setStoredActiveTenantId(nextTenantId)
  }

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId) ?? null

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenant,
        activeTenantId,
        loading,
        error,
        hasTenant: tenants.length > 0,
        refreshTenants,
        createWorkspace,
        setActiveTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}
