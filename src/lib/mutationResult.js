import { countMutationFailure, countPersistenceRejection, countStaleMutationRejection } from './diagnostics.js'
import { ERROR_MESSAGE_BY_CODE } from '../content/uxText.js'

const RAW_ERROR_PATTERNS = [
  /supabase/i,
  /\bpostgres\b/i,
  /\bsql\b/i,
  /\bfetch\b/i,
  /\bstack\b/i,
  /violates.*constraint/i,
]

const DEFAULT_USER_MESSAGES = ERROR_MESSAGE_BY_CODE

export function normalizeError(error, { code = 'persistence_failed', operation = 'mutation' } = {}) {
  const rawMessage = error?.message ?? String(error ?? '')
  const resolvedCode = error?.code === 'ACTIVE_TENANT_REQUIRED'
    ? 'missing_tenant'
    : error?.code === 'PGRST116'
      ? 'not_found'
      : code

  const message = DEFAULT_USER_MESSAGES[resolvedCode] ?? DEFAULT_USER_MESSAGES.persistence_failed

  return {
    code: resolvedCode,
    message,
    retryable: !['validation_failed', 'not_found'].includes(resolvedCode),
    operation,
    diagnostics: {
      rawMessage,
      providerCode: error?.code ?? null,
      name: error?.name ?? null,
    },
  }
}

export function ok(data = null) {
  return { ok: true, data, error: null, code: null }
}

export function fail(error, options = {}) {
  const normalized = normalizeError(error, options)
  countMutationFailure(options.operation ?? normalized.operation)
  if (normalized.code === 'stale_response') countStaleMutationRejection()
  if (normalized.code === 'persistence_failed') countPersistenceRejection()
  return {
    ok: false,
    data: null,
    error: normalized,
    code: normalized.code,
  }
}

export async function runMutation(operation, task, options = {}) {
  try {
    return ok(await task())
  } catch (error) {
    return fail(error, { operation, code: options.code ?? 'persistence_failed' })
  }
}

export function isMutationResult(value) {
  return Boolean(value && typeof value === 'object' && 'ok' in value && 'data' in value && 'error' in value)
}

export function isMutationOk(value) {
  return isMutationResult(value) ? value.ok : Boolean(value)
}

export function getMutationData(value) {
  return isMutationResult(value) ? value.data : value
}

export function getMutationError(value) {
  if (isMutationResult(value)) return value.error
  return null
}

export function getMutationMessage(value, fallback = DEFAULT_USER_MESSAGES.persistence_failed) {
  return getMutationError(value)?.message ?? fallback
}

export function hasRawErrorLeak(message) {
  return RAW_ERROR_PATTERNS.some((pattern) => pattern.test(String(message ?? '')))
}
