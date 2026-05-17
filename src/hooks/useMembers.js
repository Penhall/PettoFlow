import { useEffect, useState } from 'react'
import { useTenant } from './useTenant.js'
import {
  deleteInvitation as deleteInvitationRequest,
  inviteMember as inviteMemberRequest,
  listInvitations,
  listMembers,
  removeMember as removeMemberRequest,
  setMemberStatus as setMemberStatusRequest,
  updateMemberRole as updateMemberRoleRequest,
} from '../lib/memberApi.js'
import { canManageMembers } from '../lib/memberPermissions.js'
import { normalizeError } from '../lib/mutationResult.js'

export function useMembers() {
  const { activeTenant, activeTenantId, refreshTenants } = useTenant()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!activeTenantId || !canManageMembers(activeTenant?.role)) {
      setMembers([])
      setInvitations([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextMembers, nextInvitations] = await Promise.all([
          listMembers(activeTenantId),
          listInvitations(activeTenantId),
        ])

        if (!active) return
        setMembers(nextMembers)
        setInvitations(nextInvitations)
      } catch (loadError) {
        if (!active) return
        setError(normalizeError(loadError, { operation: 'members.load' }).message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [activeTenant?.role, activeTenantId])

  async function refresh() {
    if (!activeTenantId || !canManageMembers(activeTenant?.role)) {
      setMembers([])
      setInvitations([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        listMembers(activeTenantId),
        listInvitations(activeTenantId),
      ])
      setMembers(nextMembers)
      setInvitations(nextInvitations)
    } catch (loadError) {
      setError(normalizeError(loadError, { operation: 'members.load' }).message)
      throw loadError
    } finally {
      setLoading(false)
    }
  }

  async function inviteMember(payload) {
    if (!activeTenantId) {
      throw new Error('Espaço de trabalho ativo obrigatório para convidar membro.')
    }

    const result = await inviteMemberRequest(activeTenantId, payload)
    await refresh()
    return result
  }

  async function updateMemberRole(membershipId, role) {
    if (!activeTenantId) {
      throw new Error('Espaço de trabalho ativo obrigatório para alterar perfil.')
    }

    const result = await updateMemberRoleRequest(activeTenantId, membershipId, role)
    await Promise.all([refresh(), refreshTenants()])
    return result
  }

  async function setMemberStatus(membershipId, status) {
    if (!activeTenantId) {
      throw new Error('Espaço de trabalho ativo obrigatório para alterar status do membro.')
    }

    const result = await setMemberStatusRequest(activeTenantId, membershipId, status)
    await Promise.all([refresh(), refreshTenants()])
    return result
  }

  async function removeMember(membershipId) {
    if (!activeTenantId) {
      throw new Error('Espaço de trabalho ativo obrigatório para remover membro.')
    }

    const result = await removeMemberRequest(activeTenantId, membershipId)
    await Promise.all([refresh(), refreshTenants()])
    return result
  }

  async function deleteInvitation(invitationId) {
    if (!activeTenantId) {
      throw new Error('Espaço de trabalho ativo obrigatório para excluir convite.')
    }

    const result = await deleteInvitationRequest(activeTenantId, invitationId)
    await refresh()
    return result
  }

  return {
    members,
    invitations,
    loading,
    error,
    refresh,
    inviteMember,
    updateMemberRole,
    setMemberStatus,
    removeMember,
    deleteInvitation,
  }
}
