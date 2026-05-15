import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useRuntimeOrchestration } from '../hooks/useRuntimeOrchestration.js'
import { TenantContext } from './tenantContext.js'
import { createTenant, listMyTenants } from '../lib/tenantApi.js'
import { acceptInvitation } from '../lib/memberApi.js'
import {
  getStoredActiveTenantId,
  setStoredActiveTenantId,
  setRuntimeActiveTenantId,
} from '../lib/activeTenant.js'
import { traceAsyncFailure, traceBootstrap, traceTenant } from '../lib/diagnostics.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { ERROR_TEXT } from '../content/uxText.js'

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

function getInvitationToken() {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  return url.searchParams.get('invite')?.trim() || null
}

function clearInvitationToken() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('invite')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function TenantProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const {
    cancelTenantLoad,
    completeTransition,
    failTenantLoad,
    resolveTenantLoad,
    setActiveTenant: syncActiveTenant,
    startRetry,
    startTenantLoad,
    startTransition,
  } = useRuntimeOrchestration()
  const [tenants, setTenants] = useState([])
  const [activeTenantId, setActiveTenantIdState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [readResult, setReadResult] = useState(() => readSuccess([]))
  const tenantsRef = useRef(tenants)
  const activeTenantIdRef = useRef(activeTenantId)

  useEffect(() => {
    tenantsRef.current = tenants
    activeTenantIdRef.current = activeTenantId
  }, [tenants, activeTenantId])

  useEffect(() => {
    setRuntimeActiveTenantId(activeTenantId)
    traceTenant('active-tenant-changed', activeTenantId)
    syncActiveTenant(activeTenantId, {
      source: 'tenant-context',
      hasTenant: tenants.length > 0,
    })
    if (!activeTenantId) {
      completeTransition('tenant', {
        reason: 'no-active-tenant',
      })
    }
  }, [activeTenantId, completeTransition, syncActiveTenant, tenants.length])

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([])
      setActiveTenantIdState(null)
      setError(null)
      setReadResult(readSuccess([]))
      setLoading(false)
      setStoredActiveTenantId(null)
      setRuntimeActiveTenantId(null)
      return
    }

    let active = true
    let settled = false
    const requestId = startTenantLoad('auth-state-bootstrap', {
      authenticated: true,
    })

    async function loadTenants() {
      setLoading(true)
      setError(null)
      traceBootstrap('start', null, 'TenantContext.loadTenants')

      try {
        const invitationToken = getInvitationToken()
        if (invitationToken) {
          await acceptInvitation(invitationToken)
          if (!active) return
          clearInvitationToken()
        }

        const result = await runReadWithRetry('tenant.list', listMyTenants, {
          previousData: tenantsRef.current,
          tenantId: activeTenantIdRef.current,
          onState: setReadResult,
        })
        if (!active) return
        if (!result.ok) {
          setError(result.error?.message || ERROR_TEXT.loadWorkspaceList)
          failTenantLoad(requestId, new Error(result.error?.diagnostics?.rawMessage || result.error?.message), {
            stage: 'tenant-context.load-tenants',
          })
          settled = true
          traceBootstrap('error', null, result.error?.code)
          return
        }

        const nextTenants = result.data.map(normalizeTenantRecord)
        const nextActiveTenantId = resolveNextActiveTenantId(nextTenants)

        setTenants(nextTenants)
        setActiveTenantIdState(nextActiveTenantId)

        if (nextActiveTenantId) {
          setStoredActiveTenantId(nextActiveTenantId)
        }

        resolveTenantLoad(requestId, {
          activeTenantId: nextActiveTenantId,
          hasTenant: nextTenants.length > 0,
          tenantCount: nextTenants.length,
        })
        settled = true

        traceBootstrap('ready', nextActiveTenantId, `${nextTenants.length} tenant(s)`)
      } catch (loadError) {
        if (!active) return
        setError(ERROR_TEXT.loadWorkspaceList)
        failTenantLoad(requestId, loadError, {
          stage: 'tenant-context.load-tenants',
        })
        settled = true
        traceBootstrap('error', null, loadError?.message)
        traceAsyncFailure('bootstrap-failure', loadError, { stage: 'tenant-context.load-tenants' })
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTenants()

    return () => {
      if (!settled) {
        cancelTenantLoad(requestId, {
          stage: 'tenant-context.load-tenants.cleanup',
        })
      }
      active = false
    }
  }, [cancelTenantLoad, failTenantLoad, isAuthenticated, resolveTenantLoad, startTenantLoad])

  async function refreshTenants() {
    if (!isAuthenticated) {
      setTenants([])
      setActiveTenantIdState(null)
      setError(null)
      return []
    }

    setLoading(true)
    setError(null)
    startRetry('tenant', {
      reason: 'manual-refresh',
      tenantId: activeTenantId,
    })
    const requestId = startTenantLoad('manual-refresh', {
      activeTenantId,
    })

    try {
      const result = await runReadWithRetry('tenant.refresh', listMyTenants, {
        previousData: tenants,
        tenantId: activeTenantId,
        onState: setReadResult,
      })
      if (!result.ok) {
        setError(result.error?.message || ERROR_TEXT.loadWorkspaceList)
        failTenantLoad(requestId, new Error(result.error?.diagnostics?.rawMessage || result.error?.message), {
          stage: 'tenant-context.refresh-tenants',
        })
        return tenants
      }
      const nextTenants = result.data.map(normalizeTenantRecord)
      const currentTenantStillAccessible = activeTenantId && nextTenants.some((tenant) => tenant.id === activeTenantId)
      const nextActiveTenantId = currentTenantStillAccessible
        ? activeTenantId
        : resolveNextActiveTenantId(nextTenants)

      setTenants(nextTenants)
      setActiveTenantIdState(nextActiveTenantId)
      setStoredActiveTenantId(nextActiveTenantId)
      resolveTenantLoad(requestId, {
        activeTenantId: nextActiveTenantId,
        hasTenant: nextTenants.length > 0,
        tenantCount: nextTenants.length,
      })
      return nextTenants
    } catch (loadError) {
      setError(ERROR_TEXT.loadWorkspaceList)
      failTenantLoad(requestId, loadError, {
        stage: 'tenant-context.refresh-tenants',
      })
      traceAsyncFailure('bootstrap-failure', loadError, { stage: 'tenant-context.refresh-tenants' })
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
      setError('O espaço de trabalho selecionado não pertence ao usuário autenticado.')
      return
    }

    startTransition('tenant', {
      from: activeTenantId ?? 'none',
      to: nextTenantId,
      detail: { source: 'tenant-switcher' },
    })
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
        readResult,
        readState: readResult.state,
        stale: readResult.stale,
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
