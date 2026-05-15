import { ERROR_MESSAGE_BY_CODE, READ_TEXT } from '../content/uxText.js'
import { traceReadLifecycle } from './diagnostics.js'

export const READ_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  STALE: 'stale',
  INTERRUPTED: 'interrupted',
  UNAUTHORIZED: 'unauthorized',
  FAILED: 'failed',
  RETRYING: 'retrying',
}

const EMPTY_VALUES = new Set([null, undefined])

function isEmptyData(data) {
  if (Array.isArray(data)) return data.length === 0
  if (EMPTY_VALUES.has(data)) return true
  if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items.length === 0
  return false
}

export function normalizeReadError(error, { operation = 'read', code = 'read_failed' } = {}) {
  const status = error?.status ?? error?.response?.status ?? null
  const providerCode = error?.code ?? null
  const resolvedCode = status === 401 || status === 403 || providerCode === 'AUTH_SESSION_MISSING'
    ? 'unauthorized'
    : providerCode === 'ACTIVE_TENANT_REQUIRED'
      ? 'missing_tenant'
      : providerCode === 'AbortError'
        ? 'interrupted'
        : code

  const message = ERROR_MESSAGE_BY_CODE[resolvedCode] ?? READ_TEXT.failed

  return {
    code: resolvedCode,
    message,
    retryable: !['unauthorized', 'missing_tenant', 'interrupted'].includes(resolvedCode),
    operation,
    diagnostics: {
      rawMessage: error?.message ?? String(error ?? ''),
      providerCode,
      status,
      name: error?.name ?? null,
    },
  }
}

export function createReadResult({ data = null, error = null, state = READ_STATES.IDLE, stale = false, ok = false, ...rest } = {}) {
  return { ok, data, error, state, stale, ...rest }
}

export function readSuccess(data, options = {}) {
  const empty = options.empty ?? isEmptyData(data)
  return createReadResult({
    ok: true,
    data,
    error: null,
    state: empty ? READ_STATES.EMPTY : READ_STATES.SUCCESS,
    stale: false,
  })
}

export function readLoading(previousData = null) {
  return createReadResult({
    ok: false,
    data: previousData,
    error: null,
    state: READ_STATES.LOADING,
    stale: false,
  })
}

export function readRetrying(previousData = null) {
  return createReadResult({
    ok: false,
    data: previousData,
    error: null,
    state: READ_STATES.RETRYING,
    stale: Boolean(previousData),
  })
}

export function readFailure(error, options = {}) {
  const normalized = normalizeReadError(error, options)
  const state = normalized.code === 'unauthorized' ? READ_STATES.UNAUTHORIZED : READ_STATES.FAILED
  const previousData = options.previousData ?? null
  return createReadResult({
    ok: false,
    data: previousData,
    error: normalized,
    state,
    stale: Boolean(previousData),
  })
}

export function readInterrupted(previousData = null, error = null, options = {}) {
  return createReadResult({
    ok: false,
    data: previousData,
    error: error ? normalizeReadError(error, { ...options, code: 'interrupted' }) : null,
    state: READ_STATES.INTERRUPTED,
    stale: Boolean(previousData),
  })
}

export function readStale(previousData = null, detail = null) {
  return createReadResult({
    ok: false,
    data: previousData,
    error: null,
    state: READ_STATES.STALE,
    stale: true,
    detail,
  })
}

export async function runReadWithRetry(scope, task, {
  retries = 1,
  previousData = null,
  onState,
  signal,
  tenantId = null,
} = {}) {
  let attempt = 0
  onState?.(readLoading(previousData))
  traceReadLifecycle(scope, 'loading', { tenantId })

  while (attempt <= retries) {
    if (signal?.aborted) {
      const interrupted = readInterrupted(previousData, signal.reason, { operation: scope })
      traceReadLifecycle(scope, 'interrupted', { tenantId, attempt })
      onState?.(interrupted)
      return interrupted
    }

    try {
      const data = await task({ attempt, signal })
      const result = readSuccess(data)
      traceReadLifecycle(scope, result.state, { tenantId, attempt, stale: false })
      onState?.(result)
      return result
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') {
        const interrupted = readInterrupted(previousData, error, { operation: scope })
        traceReadLifecycle(scope, 'interrupted', { tenantId, attempt })
        onState?.(interrupted)
        return interrupted
      }

      const failed = readFailure(error, { operation: scope, previousData })
      if (failed.state === READ_STATES.UNAUTHORIZED) {
        traceReadLifecycle(scope, 'unauthorized', { tenantId, attempt })
        onState?.(failed)
        return failed
      }

      if (attempt < retries && failed.error.retryable) {
        attempt += 1
        traceReadLifecycle(scope, 'retrying', { tenantId, attempt, retries })
        onState?.(readRetrying(previousData))
        continue
      }

      traceReadLifecycle(scope, failed.stale ? 'stale' : 'failed', { tenantId, attempt, retries })
      onState?.(failed)
      return failed
    }
  }

  const failed = readFailure(new Error('read retry exhausted'), { operation: scope, previousData })
  onState?.(failed)
  return failed
}

export function isReadPending(result) {
  return result?.state === READ_STATES.LOADING || result?.state === READ_STATES.RETRYING
}
