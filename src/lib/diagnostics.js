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

  if (source === 'implicit') {
    const warningKey = `${operation}:${meta?.scope ?? 'unknown'}`
    if (!warnedOwnershipFallbacks.has(warningKey)) {
      warnedOwnershipFallbacks.add(warningKey)
      console.warn(tag('ownership'), 'IMPLICIT_FALLBACK', operation, `tenant=${tenantId ?? 'none'}`, meta ?? '')
    }
    if (!isEnabled()) return
  } else if (!isEnabled()) {
    return
  }

  const label = source === 'explicit' ? 'EXPLICIT' : 'IMPLICIT_FALLBACK'
  console.debug(tag('ownership'), label, operation, `tenant=${tenantId ?? 'none'}`, meta ?? '')
}

export function traceAsyncFailure(type, error, context = null) {
  recordEvent('async-fault', { type, message: error?.message ?? String(error), context })
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
