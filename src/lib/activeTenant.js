export const ACTIVE_TENANT_STORAGE_KEY = 'nexuscrm_active_tenant_id'

let currentActiveTenantId = null

export function getStoredActiveTenantId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY)
}

export function setStoredActiveTenantId(tenantId) {
  if (typeof window === 'undefined') return

  if (tenantId) {
    window.localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId)
    return
  }

  window.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)
}

export function setRuntimeActiveTenantId(tenantId) {
  currentActiveTenantId = tenantId || null
}

export function getRuntimeActiveTenantId() {
  return currentActiveTenantId
}

export function createTenantRequiredError() {
  const error = new Error('Espaço de trabalho ativo obrigatório para operação de negócio.')
  error.code = 'TENANT_REQUIRED'
  return error
}

export function getRequiredActiveTenantId() {
  const tenantId = currentActiveTenantId
  if (!tenantId) {
    throw createTenantRequiredError()
  }
  return tenantId
}
