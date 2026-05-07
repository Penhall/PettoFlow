import { supabase } from './supabaseClient.js'
import { createTenantRequiredError } from './activeTenant.js'

export async function authenticatedFetch(url, options = {}) {
  if (!supabase) {
    const error = new Error('Cliente Supabase não configurado.')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    throw error
  }

  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = data?.session?.access_token ?? ''
  if (!accessToken) {
    const error = new Error('Sessão autenticada obrigatória.')
    error.code = 'AUTH_SESSION_MISSING'
    throw error
  }

  const { tenantId = null, requireTenant = false, headers: customHeaders = {}, ...fetchOptions } = options
  if (requireTenant && !tenantId) {
    throw createTenantRequiredError()
  }

  const needsJsonContentType = fetchOptions.body !== undefined || (fetchOptions.method && fetchOptions.method !== 'GET')
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(needsJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    ...customHeaders,
  }

  return fetch(url, { ...fetchOptions, headers })
}
