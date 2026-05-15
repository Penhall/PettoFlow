/**
 * Lightweight feature flag system for controlled rollout.
 *
 * Flags are resolved in priority order:
 *   1. window.__NEXUS_FLAGS__ (operator override at runtime)
 *   2. localStorage key 'nexus_flags' (persistent per-session override)
 *   3. DEFAULT_FLAGS (safe defaults)
 *
 * No external service dependency. Suitable for controlled real-user rollout
 * where individual flags can be toggled per session by operators without a
 * deployment.
 *
 * Usage:
 *   import { isEnabled, setFlag, getAllFlags } from './featureFlags.js'
 *   if (isEnabled('onboarding_recovery_prompt')) { ... }
 */

const DEFAULT_FLAGS = {
  // Onboarding
  onboarding_recovery_prompt: true,     // show recovery UI when onboarding load fails
  onboarding_retry_on_failure: true,    // allow retry after onboarding state load fails

  // Safety guards
  destructive_action_confirm: true,     // confirm before destructive actions (delete task, etc.)
  partial_failure_warning: true,        // show degraded-state banner after partial failures

  // Diagnostics
  diagnostics_panel: false,             // enable operator diagnostics panel (admin-only)

  // Recovery flows
  stale_session_recovery: true,         // show recovery prompt on stale session detection
  tenant_mismatch_recovery: true,       // show recovery prompt on tenant mismatch

  // Rollout controls
  telegram_integration: true,          // allow Telegram integration in settings
  finance_rules_engine: true,          // allow finance rules engine
}

function readLocalStorageFlags() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem('nexus_flags')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // ignore malformed JSON
  }
  return {}
}

function readRuntimeFlags() {
  if (typeof window === 'undefined') return {}
  const flags = window.__NEXUS_FLAGS__
  if (flags && typeof flags === 'object') return flags
  return {}
}

function resolveFlags() {
  return {
    ...DEFAULT_FLAGS,
    ...readLocalStorageFlags(),
    ...readRuntimeFlags(),
  }
}

export function isEnabled(flag) {
  return Boolean(resolveFlags()[flag])
}

export function getAllFlags() {
  return resolveFlags()
}

export function setFlag(flag, value) {
  if (typeof window === 'undefined') return
  try {
    const current = readLocalStorageFlags()
    const next = { ...current, [flag]: value }
    window.localStorage.setItem('nexus_flags', JSON.stringify(next))
  } catch {
    // ignore storage errors
  }
}

export function clearFlagOverrides() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem('nexus_flags')
    delete window.__NEXUS_FLAGS__
  } catch {
    // ignore
  }
}

export function resetToDefaults() {
  clearFlagOverrides()
}

export { DEFAULT_FLAGS }
