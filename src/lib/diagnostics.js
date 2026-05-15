/**
 * Runtime diagnostics for stabilization work.
 * All output is gated behind the __NEXUS_DIAG__ flag.
 */

const EVENT_BUFFER_KEY = '__NEXUS_DIAG_EVENTS__'
const MAX_EVENT_BUFFER = 250
const warnedOwnershipFallbacks = new Set()

function isEnabled() {
  return typeof window !== 'undefined' && Boolean(window.__NEXUS_DIAG__)
}

export function isStrictOwnershipMode() {
  return typeof window !== 'undefined' && Boolean(window.__NEXUS_STRICT_OWNERSHIP__)
}

function stamp() {
  return new Date().toISOString().slice(11, 23)
}

function tag(area) {
  return `[NexusDiag][${stamp()}][${area}]`
}

function recordEvent(kind, payload = {}) {
  if (typeof window === 'undefined') return
  const buffer = Array.isArray(window[EVENT_BUFFER_KEY]) ? window[EVENT_BUFFER_KEY] : []
  buffer.push({
    kind,
    at: new Date().toISOString(),
    ...payload,
  })
  if (buffer.length > MAX_EVENT_BUFFER) {
    buffer.splice(0, buffer.length - MAX_EVENT_BUFFER)
  }
  window[EVENT_BUFFER_KEY] = buffer
}

export function traceRender(componentName, props = {}) {
  if (!isEnabled()) return
  console.debug(tag('render'), componentName, props)
}

export function traceAsync(label, phase, detail = null) {
  recordEvent('async', { label, phase, detail })
  if (!isEnabled()) return
  const phases = { start: 'START', resolve: 'RESOLVE', reject: 'REJECT', cancel: 'CANCEL' }
  console.debug(tag('async'), phases[phase] || phase, label, detail ?? '')
}

export function traceEffect(componentName, effectName, phase) {
  if (!isEnabled()) return
  const phases = { mount: 'MOUNT', update: 'UPDATE', cleanup: 'CLEANUP' }
  console.debug(tag('effect'), phases[phase] || phase, `${componentName}#${effectName}`)
}

export function traceModal(modalName, event, detail = null) {
  if (!isEnabled()) return
  const events = { open: 'OPEN', close: 'CLOSE', mount: 'MOUNT', unmount: 'UNMOUNT' }
  console.debug(tag('modal'), events[event] || event, modalName, detail ?? '')
}

export function traceSuspense(boundaryId, phase) {
  if (phase === 'suspend') countSuspenseFallback()
  if (!isEnabled()) return
  const phases = { suspend: 'SUSPEND', resolve: 'RESOLVE', error: 'ERROR' }
  console.debug(tag('suspense'), phases[phase] || phase, boundaryId)
}

export function traceNavigation(from, to, method = 'tab') {
  if (!isEnabled()) return
  console.debug(tag('nav'), `${from} -> ${to}`, `(${method})`)
}

export function traceContext(contextName, key, value) {
  if (!isEnabled()) return
  console.debug(tag('ctx'), contextName, key, '=', value)
}

export function traceTenant(event, tenantId = null) {
  if (!isEnabled()) return
  console.debug(tag('tenant'), event, tenantId ?? '(none)')
}

export function traceSnapshot(label, data) {
  if (!isEnabled()) return
  console.groupCollapsed(`${tag('snapshot')} ${label}`)
  console.debug(data)
  console.groupEnd()
}

export function diagWarn(area, message, detail = null) {
  recordEvent('warning', { area, message, detail })
  if (!isEnabled()) return
  console.warn(tag(area), 'WARN', message, detail ?? '')
}

export function traceBootstrap(phase, tenantId = null, detail = null) {
  recordEvent('bootstrap', { phase, tenantId, detail })
  if (!isEnabled()) return
  const phases = {
    start: 'START',
    loading: 'LOADING',
    ready: 'READY',
    error: 'ERROR',
    retry: 'RETRY',
    cancelled: 'CANCELLED',
    'tenant-change': 'TENANT_CHANGE',
  }
  console.debug(tag('bootstrap'), phases[phase] ?? phase, `tenant=${tenantId ?? 'none'}`, detail ?? '')
}

export function traceOwnership(operation, tenantId, source, meta = null) {
  recordEvent('ownership', { operation, tenantId, source, meta })
  countOwnershipViolation(source)

  if (source === 'implicit') {
    const warningKey = `${operation}:${meta?.scope ?? 'unknown'}`
    if (!warnedOwnershipFallbacks.has(warningKey)) {
      warnedOwnershipFallbacks.add(warningKey)
      // Só gera console.warn em modo strict
      if (isStrictOwnershipMode()) {
        console.warn(tag('ownership'), 'IMPLICIT_FALLBACK', operation, `tenant=${tenantId ?? 'none'}`, meta ?? '')
      }
    }
    if (!isEnabled()) return
  } else if (!isEnabled()) {
    return
  }

  const label = source === 'explicit' ? 'EXPLICIT' : 'IMPLICIT_FALLBACK'
  if (isEnabled() || isStrictOwnershipMode()) {
    console.debug(tag('ownership'), label, operation, `tenant=${tenantId ?? 'none'}`, meta ?? '')
  }
}

export function traceAsyncFailure(type, error, context = null) {
  recordEvent('async-fault', { type, message: error?.message ?? String(error), context })
  countAsyncFailure(type)
  if (!isEnabled()) return
  const classes = {
    'unhandled-rejection': 'UNHANDLED_REJECTION',
    'lazy-load-failure': 'LAZY_LOAD_FAILURE',
    'async-event': 'ASYNC_EVENT_FAILURE',
    'bootstrap-failure': 'BOOTSTRAP_FAILURE',
    'auth-failure': 'AUTH_FAILURE',
    'network-failure': 'NETWORK_FAILURE',
    'onboarding-failure': 'ONBOARDING_FAILURE',
    'transition-failure': 'TRANSITION_FAILURE',
  }
  console.error(tag('async-fault'), classes[type] ?? type, type, error?.message ?? String(error), context ?? '')
}

export function traceRouteTransition(from, to, phase) {
  recordEvent('route-transition', { from, to, phase })
  if (!isEnabled()) return
  const phases = { start: 'START', complete: 'COMPLETE', suspended: 'SUSPENDED', interrupted: 'INTERRUPTED', error: 'ERROR' }
  console.debug(tag('route-transition'), phases[phase] ?? phase, `${from} -> ${to}`)
}

export function traceOrchestrationTransition(from, to, reason, detail = null) {
  recordEvent('orchestration-transition', { from, to, reason, detail })
  if (!isEnabled()) return
  console.debug(tag('orchestration'), `${from} -> ${to}`, reason, detail ?? '')
}

export function traceRetryLifecycle(scope, phase, detail = null) {
  recordEvent('orchestration-retry', { scope, phase, detail })
  if (phase === 'start') countBootstrapRetry()
  if (!isEnabled()) return
  console.debug(tag('retry'), scope, phase, detail ?? '')
}

export function traceTransitionConflict(kind, active, next) {
  recordEvent('orchestration-conflict', { transitionKind: kind, active, next })
  countTransitionConflict()
  if (!isEnabled()) return
  console.warn(tag('orchestration-conflict'), kind, active, next)
}

export function traceCancellation(label, detail = null) {
  recordEvent('orchestration-cancel', { label, detail })
  countCancellation()
  if (!isEnabled()) return
  console.debug(tag('cancel'), label, detail ?? '')
}

// ═══════════════════════════════════════════
// Telemetry Counters (bounded, gated, dev-safe)
// ═══════════════════════════════════════════

const TELEMETRY = {}
const MAX_COUNTER = 999999

function incCounter(key) {
  TELEMETRY[key] = (TELEMETRY[key] ?? 0) + 1
  if (TELEMETRY[key] > MAX_COUNTER) TELEMETRY[key] = MAX_COUNTER
}

/**
 * Retorna snapshot dos contadores de telemetria.
 * Bounded, não aloca memória infinita, seguro para produção.
 */
export function getTelemetrySnapshot() {
  return { ...TELEMETRY }
}

/**
 * Informa se a assinatura de telemetria (contadores) está ativa.
 */
export function hasTelemetry() {
  return typeof window !== 'undefined'
}

// Contadores específicos — chamados pelas funções de trace existentes
// para acumular métricas operacionais sem overhead de console.

export function countOwnershipViolation(source) {
  if (source === 'implicit') incCounter('ownership_implicit')
  incCounter('ownership_total')
}

export function countTransitionConflict() {
  incCounter('transition_conflicts')
}

export function countBootstrapRetry() {
  incCounter('bootstrap_retries')
}

export function countSuspenseFallback() {
  incCounter('suspense_fallbacks')
}

export function countChunkLoadError() {
  incCounter('chunk_load_errors')
}

export function countStaleRequestInterruption() {
  incCounter('stale_request_interruptions')
}

export function countCancellation() {
  incCounter('cancellations')
}

export function countAsyncFailure(type) {
  incCounter(`async_failure_${type}`)
}

export function resetTelemetry() {
  Object.keys(TELEMETRY).forEach((key) => delete TELEMETRY[key])
}

// ═══════════════════════════════════════════
// Performance Hardening Helpers (leves, dev-safe)
// ═══════════════════════════════════════════

const RERENDER_COUNTS = {}
const MAX_RERENDER_KEYS = 50

export function traceRerenderDiagnostics(componentName) {
  if (!isEnabled()) return
  RERENDER_COUNTS[componentName] = (RERENDER_COUNTS[componentName] ?? 0) + 1
  const count = RERENDER_COUNTS[componentName]
  if (count > 1) {
    console.debug(tag('perf'), `[rerender#${count}] ${componentName}`)
  }
  // Mantém apenas os N componentes mais recentes
  const keys = Object.keys(RERENDER_COUNTS)
  if (keys.length > MAX_RERENDER_KEYS) {
    const oldest = keys.slice(0, keys.length - MAX_RERENDER_KEYS)
    oldest.forEach((k) => delete RERENDER_COUNTS[k])
  }
}

export function getRerenderCounts() {
  return { ...RERENDER_COUNTS }
}

const TRANSITION_TIMINGS = {}

export function traceTransitionTiming(kind, phase, meta = null) {
  if (!isEnabled()) return
  if (phase === 'start') {
    TRANSITION_TIMINGS[kind] = { start: performance.now(), meta }
    console.debug(tag('perf'), `[transition-start] ${kind}`, meta ?? '')
  } else if (phase === 'end' && TRANSITION_TIMINGS[kind]) {
    const elapsed = performance.now() - TRANSITION_TIMINGS[kind].start
    console.debug(tag('perf'), `[transition-end] ${kind} ${elapsed.toFixed(0)}ms`, meta ?? '')
    delete TRANSITION_TIMINGS[kind]
  }
}

export function getTransitionTimings() {
  return { ...TRANSITION_TIMINGS }
}

const PROVIDER_UPDATE_COUNTS = {}

export function traceProviderChurn(providerName) {
  if (!isEnabled()) return
  PROVIDER_UPDATE_COUNTS[providerName] = (PROVIDER_UPDATE_COUNTS[providerName] ?? 0) + 1
  const count = PROVIDER_UPDATE_COUNTS[providerName]
  if (count % 10 === 0) {
    console.debug(tag('perf'), `[provider-churn#${count}] ${providerName}`)
  }
}

export function getProviderChurnCounts() {
  return { ...PROVIDER_UPDATE_COUNTS }
}

const SUSPENSE_TIMINGS = {}

export function traceSuspenseTiming(boundaryId, phase) {
  if (!isEnabled()) return
  if (phase === 'suspend') {
    SUSPENSE_TIMINGS[boundaryId] = performance.now()
    console.debug(tag('perf'), `[suspense] ${boundaryId} SUSPENDED`)
  } else if (phase === 'resolve' && SUSPENSE_TIMINGS[boundaryId]) {
    const elapsed = performance.now() - SUSPENSE_TIMINGS[boundaryId]
    console.debug(tag('perf'), `[suspense] ${boundaryId} RESOLVED in ${elapsed.toFixed(0)}ms`)
    delete SUSPENSE_TIMINGS[boundaryId]
  }
}

export function getSuspenseTimings() {
  return { ...SUSPENSE_TIMINGS }
}

export function resetPerformanceCounters() {
  Object.keys(RERENDER_COUNTS).forEach((k) => delete RERENDER_COUNTS[k])
  Object.keys(TRANSITION_TIMINGS).forEach((k) => delete TRANSITION_TIMINGS[k])
  Object.keys(PROVIDER_UPDATE_COUNTS).forEach((k) => delete PROVIDER_UPDATE_COUNTS[k])
  Object.keys(SUSPENSE_TIMINGS).forEach((k) => delete SUSPENSE_TIMINGS[k])
}
