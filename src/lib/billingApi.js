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

export async function fetchTenantBillingOverview(tenantId) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/billing`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })

  return parseResponse(res, 'Erro ao carregar billing do workspace')
}

export async function createBillingCheckoutSession(tenantId, payload) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/billing/checkout`, {
    method: 'POST',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(payload),
  })

  return parseResponse(res, 'Erro ao iniciar checkout de billing')
}

export async function createBillingPortalSession(tenantId) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/billing/portal`, {
    method: 'POST',
    tenantId,
    requireTenant: true,
  })

  return parseResponse(res, 'Erro ao abrir portal de billing')
}

export async function listTenantAuditLogs(tenantId, { action = '', limit = 50 } = {}) {
  const url = new URL(`${TENANT_CORE_URL}/tenants/${tenantId}/audit-logs`)
  if (action) url.searchParams.set('action', action)
  url.searchParams.set('limit', String(limit))

  const res = await authenticatedFetch(url.toString(), {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })

  return parseResponse(res, 'Erro ao carregar timeline de auditoria')
}
