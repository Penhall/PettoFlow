import { authenticatedFetch } from './apiFetch.js'

const TENANT_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tenant-core`

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

export async function getOnboardingState(tenantId) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/onboarding`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })

  return parseResponse(res, 'Erro ao carregar onboarding')
}

export async function updateOnboardingState(tenantId, payload) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/onboarding`, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(payload),
  })

  return parseResponse(res, 'Erro ao atualizar onboarding')
}

export async function recordOnboardingEvent(tenantId, eventName, eventPayload = {}) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/onboarding/events`, {
    method: 'POST',
    tenantId,
    requireTenant: true,
    body: JSON.stringify({ eventName, eventPayload }),
  })

  return parseResponse(res, 'Erro ao registrar evento de onboarding')
}
