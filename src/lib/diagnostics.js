/**
 * Runtime diagnostics for stabilization work.
 * All output is gated behind the __NEXUS_DIAG__ flag.
 */

function isEnabled() {
  return typeof window !== 'undefined' && Boolean(window.__NEXUS_DIAG__)
}

function stamp() {
  return new Date().toISOString().slice(11, 23)
}

function tag(area) {
  return `[NexusDiag][${stamp()}][${area}]`
}

export function traceRender(componentName, props = {}) {
  if (!isEnabled()) return
  console.debug(tag('render'), componentName, props)
}

export function traceAsync(label, phase, detail = null) {
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
  if (!isEnabled()) return
  console.warn(tag(area), 'WARN', message, detail ?? '')
}

export function traceBootstrap(phase, tenantId = null, detail = null) {
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
  if (!isEnabled()) return
  const label = source === 'explicit' ? 'EXPLICIT' : 'IMPLICIT_FALLBACK'
  console.debug(tag('ownership'), label, operation, `tenant=${tenantId ?? 'none'}`, meta ?? '')
}

export function traceAsyncFailure(type, error, context = null) {
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
  if (!isEnabled()) return
  const phases = { start: 'START', complete: 'COMPLETE', suspended: 'SUSPENDED', error: 'ERROR' }
  console.debug(tag('route-transition'), phases[phase] ?? phase, `${from} -> ${to}`)
}
