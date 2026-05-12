import { supabase } from './supabaseClient.js'

const ADMIN_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-core`

export async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão obrigatória')
  const res = await fetch(`${ADMIN_CORE_URL}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error || `Erro ${res.status}`)
  }
  return res.json()
}

export const fetchAdminTenants = () => adminFetch('/tenants')
export const fetchAdminTenantDetail = (id) => adminFetch(`/tenants/${id}`)
export const fetchAdminMetrics = () => adminFetch('/metrics')
export const updateTenantPlan = (tenantId, planSlug) =>
  adminFetch(`/tenants/${tenantId}/plan`, { method: 'PATCH', body: { plan_slug: planSlug } })

export const suspendTenant = (tenantId) =>
  adminFetch(`/tenants/${tenantId}/suspend`, { method: 'POST', body: { action: 'suspend' } })

export const reactivateTenant = (tenantId) =>
  adminFetch(`/tenants/${tenantId}/suspend`, { method: 'POST', body: { action: 'reactivate' } })

export const fetchAdminBilling = () => adminFetch('/billing')

export const fetchAdminAudit = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.tenantId) params.set('tenant_id', filters.tenantId)
  if (filters.eventName) params.set('event_name', filters.eventName)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('page_size', String(filters.pageSize))
  const qs = params.toString()
  return adminFetch(`/audit${qs ? `?${qs}` : ''}`)
}
