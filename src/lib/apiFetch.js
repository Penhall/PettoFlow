import { createTenantRequiredError } from './activeTenant.js'
import { traceAsyncFailure } from './diagnostics.js'
import { handleRuntimeFixtureRequest } from './runtimeFixture.js'
import { supabase } from './supabaseClient.js'

export async function authenticatedFetch(url, options = {}) {
  if (!supabase) {
    const error = new Error('Cliente Supabase não configurado.')
    error.code = 'SUPABASE_NOT_CONFIGURED'
    traceAsyncFailure('auth-failure', error, { url, stage: 'supabase-missing' })
    throw error
  }

  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    traceAsyncFailure('auth-failure', sessionError, { url, stage: 'get-session' })
    throw sessionError
  }

  const accessToken = data?.session?.access_token ?? ''
  if (!accessToken) {
    const error = new Error('Sessão autenticada obrigatória.')
    error.code = 'AUTH_SESSION_MISSING'
    traceAsyncFailure('auth-failure', error, { url, stage: 'missing-access-token' })
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

  const runtimeResponse = await handleRuntimeFixtureRequest(url, {
    ...fetchOptions,
    headers: customHeaders,
    tenantId,
    requireTenant,
  })
  if (runtimeResponse) {
    return runtimeResponse
  }

  try {
    return await fetch(url, { ...fetchOptions, headers })
  } catch (error) {
    traceAsyncFailure('network-failure', error, {
      url,
      method: fetchOptions.method || 'GET',
      tenantId,
    })
    throw error
  }
}
