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

  const externalSignal = fetchOptions.signal
  delete fetchOptions.signal

  const FETCH_TIMEOUT_MS = 15000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const abortFromExternal = () => controller.abort()

  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true })
  }

  try {
    return await fetch(url, { ...fetchOptions, headers, signal: controller.signal })
  } catch (error) {
    traceAsyncFailure('network-failure', error, {
      url,
      method: fetchOptions.method || 'GET',
      tenantId,
    })
    throw error
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortFromExternal)
  }
}
