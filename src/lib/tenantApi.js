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

export async function listMyTenants() {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants`, { method: 'GET' })
  const data = await parseResponse(res, 'Erro ao carregar workspaces')
  return data.items ?? []
}

export async function createTenant({ name, slug }) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants`, {
    method: 'POST',
    body: JSON.stringify({ name, slug }),
  })

  return parseResponse(res, 'Erro ao criar workspace')
}

export async function getTenantSettings(tenantId) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/settings`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })

  return parseResponse(res, 'Erro ao carregar configuracoes do workspace')
}

export async function updateTenantSettings(tenantId, value) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/settings`, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify({ value }),
  })

  return parseResponse(res, 'Erro ao atualizar configuracoes do workspace')
}
