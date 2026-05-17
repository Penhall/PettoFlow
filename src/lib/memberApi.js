import { authenticatedFetch } from './apiFetch.js'

const INVITE_MEMBER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`

async function parseResponse(res, fallbackMessage) {
  let data = null

  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error ?? fallbackMessage ?? `Erro ${res.status}`)
  }

  return data
}

export async function listMembers(tenantId) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/members`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })
  const data = await parseResponse(res, 'Erro ao carregar membros')
  return data.items ?? []
}

export async function listInvitations(tenantId) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/invitations`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })
  const data = await parseResponse(res, 'Erro ao carregar convites')
  return data.items ?? []
}

export async function inviteMember(tenantId, payload) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/invitations`, {
    method: 'POST',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'Erro ao criar convite')
}

export async function acceptInvitation(token) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/accept`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  return parseResponse(res, 'Erro ao aceitar convite')
}

export async function updateMemberRole(tenantId, membershipId, role) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/members/${membershipId}/role`, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify({ role }),
  })
  return parseResponse(res, 'Erro ao atualizar role do membro')
}

export async function setMemberStatus(tenantId, membershipId, status) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/members/${membershipId}/status`, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify({ status }),
  })
  return parseResponse(res, 'Erro ao atualizar status do membro')
}

export async function removeMember(tenantId, membershipId) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/members/${membershipId}`, {
    method: 'DELETE',
    tenantId,
    requireTenant: true,
  })
  return parseResponse(res, 'Erro ao remover membro')
}

export async function deleteInvitation(tenantId, invitationId) {
  const res = await authenticatedFetch(`${INVITE_MEMBER_URL}/tenants/${tenantId}/invitations/${invitationId}`, {
    method: 'DELETE',
    tenantId,
    requireTenant: true,
  })
  return parseResponse(res, 'Erro ao excluir convite')
}
