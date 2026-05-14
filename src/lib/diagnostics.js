/**
 * Runtime diagnostics for stabilization phase.
 * All output is gated behind the __NEXUS_DIAG__ flag — set in DevTools console to activate.
 * Produces no output and no side-effects in production unless the flag is set.
 *
 * Usage: window.__NEXUS_DIAG__ = true  (DevTools console)
 *        window.__NEXUS_DIAG__ = false (disable)
 */

function isEnabled() {
  return typeof window !== 'undefined' && Boolean(window.__NEXUS_DIAG__)
}

function stamp() {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function tag(area) {
  return `[NexusDiag][${stamp()}][${area}]`
}

// ─── Render tracing ────────────────────────────────────────────────────────

export function traceRender(componentName, props = {}) {
  if (!isEnabled()) return
  console.debug(tag('render'), componentName, props)
}

// ─── Async flow tracing ────────────────────────────────────────────────────

export function traceAsync(label, phase, detail = null) {
  if (!isEnabled()) return
  const phases = { start: '▶', resolve: '✔', reject: '✖', cancel: '⊘' }
  console.debug(tag('async'), phases[phase] || phase, label, detail ?? '')
}

// ─── Effect lifecycle tracing ──────────────────────────────────────────────

export function traceEffect(componentName, effectName, phase) {
  if (!isEnabled()) return
  const phases = { mount: '⬆', update: '↺', cleanup: '⬇' }
  console.debug(tag('effect'), phases[phase] || phase, `${componentName}#${effectName}`)
}

// ─── Modal lifecycle tracing ───────────────────────────────────────────────

export function traceModal(modalName, event, detail = null) {
  if (!isEnabled()) return
  const events = { open: '◈ OPEN', close: '◉ CLOSE', mount: '▲ MOUNT', unmount: '▼ UNMOUNT' }
  console.debug(tag('modal'), events[event] || event, modalName, detail ?? '')
}

// ─── Suspense boundary tracing ─────────────────────────────────────────────

export function traceSuspense(boundaryId, phase) {
  if (!isEnabled()) return
  const phases = { suspend: '⏳ SUSPEND', resolve: '✅ RESOLVE', error: '❌ ERROR' }
  console.debug(tag('suspense'), phases[phase] || phase, boundaryId)
}

// ─── Navigation tracing ────────────────────────────────────────────────────

export function traceNavigation(from, to, method = 'tab') {
  if (!isEnabled()) return
  console.debug(tag('nav'), `${from} → ${to}`, `(${method})`)
}

// ─── Context sync tracing ──────────────────────────────────────────────────

export function traceContext(contextName, key, value) {
  if (!isEnabled()) return
  console.debug(tag('ctx'), contextName, key, '=', value)
}

// ─── Tenant/auth tracing ───────────────────────────────────────────────────

export function traceTenant(event, tenantId = null) {
  if (!isEnabled()) return
  console.debug(tag('tenant'), event, tenantId ?? '(none)')
}

// ─── Grouped snapshot ─────────────────────────────────────────────────────

export function traceSnapshot(label, data) {
  if (!isEnabled()) return
  console.groupCollapsed(tag('snapshot') + ' ' + label)
  console.debug(data)
  console.groupEnd()
}

// ─── Warning ──────────────────────────────────────────────────────────────

export function diagWarn(area, message, detail = null) {
  if (!isEnabled()) return
  console.warn(tag(area), '⚠', message, detail ?? '')
}
