# Phase 33 — Independent Runtime Audit

**Auditor:** Independent Principal Frontend Auditor  
**Date:** 2026-05-15  
**Branch:** main  
**Validation:** `npm run lint` ✅ · `npm test` 225/225 ✅ · `npm run build` ✅

---

## 1. Executive Assessment

Phase 33 delivers a partial, uneven integration of product surfaces with the runtime contract system. The underlying runtime architecture (Phases 27–32) is solid and passes all validation gates. However, Phase 33's own claimed deliverables contain one functional bug that renders a headline telemetry counter permanently inoperative, one wiring omission, and a documented test count that does not match the actual file contents.

**Summary verdict:** Conditionally acceptable. The runtime architecture is not regressed. The product-level additions are partially broken and partially overrepresented in the documentation. Broader feature expansion is premature until the identified bugs are corrected and the test count claim is reconciled.

---

## 2. Validation Results (Independent)

| Gate | Result | Notes |
|------|--------|-------|
| ESLint (--max-warnings 0) | ✅ Clean | No warnings |
| Vitest (unit tests) | ✅ 225/225 | 50 test files |
| Vite build | ✅ ~6.1s | No chunk warnings |
| Test file count | ⚠️ | Noise errors in test run (useAuth outside-provider test) do not cause failures |

The test run emits two `Error: useAuth deve ser usado dentro de um AuthProvider` stack traces to stderr. These are intentional negative-path test fixtures, not failures. However, they produce noise in CI output and could mask real errors in the future.

---

## 3. Onboarding System Evaluation

### Claim: "Orchestration-aware, cancellation-safe, tenant-safe"

**Orchestration integration:** Confirmed. `dismissSurface()` calls `startOrchTransition('ui-overlay', ...)` before the patch and `completeOrchTransition('ui-overlay', ...)` after the patch resolves. The transition lifecycle is closed in both the success and error path (because `patchState` resolves with `null` on error rather than rejecting, `.then()` always executes).

**Cancellation safety:** Confirmed. The serial mutation queue with `committed StateRef` pattern is architecturally sound and correctly tested. Rapid concurrent mutations do not produce stale overwrites.

**Tenant safety:** Confirmed. The `cancelled` flag in the load `useEffect` correctly discards stale responses on tenant change. `tenantId` is required for all mutation paths.

### Critical Bug Found: `countOnboardingDropOff()` is permanently dead code

**File:** `src/hooks/useOnboarding.js`, line 198

```js
// INSIDE dismissSurface:
const anyPending = state.checklist && state.checklist.some((item) => !item.completed)
if (anyPending) {
  countOnboardingDropOff()
}
```

`state` here is the raw server-response state object (shape: `{ checklistState, tourState, tutorialState, dismissState, ... }`). It does NOT have a `checklist` key. The derived `checklist` variable is local to the hook body, computed separately:

```js
// LATER in the hook body:
const checklist = ONBOARDING_CHECKLIST.map((item) => ({
  ...item,
  completed: Boolean(state.checklistState?.items?.[item.id]?.completed),
}))
```

`state.checklist` is always `undefined`. The guard `state.checklist && ...` short-circuits to `false` unconditionally. `countOnboardingDropOff()` is never called. The drop-off counter always reads `0`.

**Severity: HIGH.** This is a Phase 33 executive deliverable ("onboarding drop-off metric") that is non-functional. The counter is not merely unwired — the wiring exists but references the wrong object property.

**Fix required:** Replace `state.checklist` with the derived `checklist` variable:

```js
const anyPending = checklist.some((item) => !item.completed)
```

### Minor Issue: `completeOrchTransition` fires even on persistence failure

When `patchState` fails (network error, server error), it resolves with `null`. The `.then((result) => { completeOrchTransition('ui-overlay', ...); return result })` fires with `result = null`, marking the `ui-overlay` transition as complete in the orchestration state even though the dismiss was not persisted. This is semantically incorrect: the overlay dismissal failed but orchestration is told it succeeded. Not a crash, but produces false-positive orchestration state.

---

## 4. Feature Governance Integration Evaluation

### CommandsSection

**Claim:** `countCommandFailure()` in 4 catch blocks.

**Verified:** Correct. Lines 34, 53, 64, 80 in `CommandsSection.jsx`. All four operations (load, toggle, delete, seed) are wired.

**Unrelated UX defect (pre-existing, surfaced by audit):** The error display at lines 147–150 replaces the entire section on any error:

```jsx
if (error) {
  return <div style={{ color: '#fecaca', marginBottom: 12 }}>Erro: {error}</div>
}
```

A successful load followed by a toggle failure causes `setError(err.message)` to trigger a re-render where this branch executes — erasing the visible command list. The user must reload the page. This is not a Phase 33 regression (the `setError` calls pre-date Phase 33), but Phase 33's UX audit claimed this surface is "Consistent" with "Premium UX." It is not.

### TelegramSection

**Claim:** `countTelegramIntegrationFailure()` in 5 catch blocks.

**Verified: Only 4 of 5 are wired.**

| Operation | Catch block wired? |
|-----------|-------------------|
| `handleToggleActive` (line 27) | ✅ |
| `handleSaveLlm` (line 46) | ✅ |
| `handleSaveThreshold` (line 61) | ✅ |
| `loadConfig` (line 211, gated behind non-401/403) | ✅ |
| `deleteBotConfig` / disconnect (lines 182–184) | ❌ MISSING |

The disconnect button's catch block:

```js
} catch (err) {
  setError(err.message)
  // countTelegramIntegrationFailure() is absent here
}
```

The Phase 33 document's table claims 5 catch blocks. The implementation has 4. Disconnect failures are not counted.

**Severity: MEDIUM.** A claimed deliverable is partially unimplemented. The missing counter is operationally meaningful — disconnect failures are high-signal events.

---

## 5. Product Telemetry Evaluation

### Counter wiring status

| Counter | Function | Wired? | Correct? |
|---------|----------|--------|---------|
| `onboarding_completed` | `countOnboardingCompleted()` | ✅ | ✅ |
| `onboarding_dropoff` | `countOnboardingDropOff()` | ✅ (import + call) | ❌ Dead — `state.checklist` is always undefined |
| `overlay_interruptions` | `countOverlayInterruption()` | ✅ | ✅ |
| `command_failures` | `countCommandFailure()` | ✅ (4 blocks) | ✅ |
| `telegram_failures` | `countTelegramIntegrationFailure()` | ⚠️ (4/5 blocks) | ⚠️ Disconnect path untracked |
| `settings_conflicts` | `countSettingsSaveConflict()` | ❌ Unimplemented | N/A |
| `onboarding_retries` | `countOnboardingRetry()` | ✅ | ✅ (but semantically odd: counts load failures as "retries" before any retry attempt exists) |

### Counter architecture

The `incCounter` / `TELEMETRY` module singleton pattern is correct. Bounding at `MAX_COUNTER = 999999` is implemented properly:

```js
function incCounter(key) {
  TELEMETRY[key] = (TELEMETRY[key] ?? 0) + 1
  if (TELEMETRY[key] > MAX_COUNTER) TELEMETRY[key] = MAX_COUNTER
}
```

Note: The increment happens before the cap check, so the counter transiently reaches `1000000` for one operation before being clamped. Functionally harmless but not strictly bounded during execution.

### `hasTelemetry()` semantic mismatch

```js
export function hasTelemetry() {
  return typeof window !== 'undefined'
}
```

This function does not check whether telemetry data exists. It checks the execution environment. It should be named `isBrowserContext()` or `isTelemetryAvailable()`. The name implies "do we have telemetry readings?" but the answer is always `true` in a browser regardless of whether any counters have incremented.

### Telemetry scope assessment

Counters are pure in-memory, non-persistent, non-exported. They reset on every page reload. A developer must open DevTools and call `window.__NEXUS_DIAG_EVENTS__` or import `getTelemetrySnapshot()` to read values. This is acceptable for development-phase observability. For production use, these counters are invisible without console access — no dashboards, no persistence, no export path. This is acknowledged in the Phase 33 document but worth restating: current telemetry is development infrastructure, not production observability.

---

## 6. Mounted-Runtime Feature Stress-Test Evaluation

Tests in `phase33-contracts.test.js` sections 3 and 6 run:
- 50 rapid `TRANSITION_START`/`TRANSITION_COMPLETE` cycles — verifies no state corruption
- Stale request ID rejection under overlapping tenant loads — correct
- 1000 rapid telemetry writes — no throws
- 5000 counter increments — passes

**Substantive finding — "bounded" telemetry test is semantically weak:**

```js
it('telemetry snapshots remain bounded after heavy load', () => {
  for (let i = 0; i < 5000; i++) {
    countOnboardingCompleted()
  }
  const snapshot = getTelemetrySnapshot()
  expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(1)  // vacuous
  expect(snapshot.onboarding_completed).toBe(5000)  // 5000 < MAX_COUNTER, cap never tested here
})
```

5000 is well below `MAX_COUNTER` (999999). This test proves counters accumulate correctly, not that they are bounded. The actual bounding test exists separately ("all counters are bounded under MAX_COUNTER") and is correct. The naming of this test overstates what it verifies.

---

## 7. Feature Cancellation Hardening Evaluation

**Assessment:** The cancellation model is sound at the hook level. The serial `mutationQueue` pattern prevents concurrent `patchState` calls from overwriting each other. The `cancelled` ref in the `useEffect` correctly discards stale load callbacks.

Section 4 of the contracts test ("Feature cancellation hardening") contains exactly 1 test:

```js
it('cancellation counter works', () => {
  const before = getTelemetrySnapshot().cancellations ?? 0
  countCancellation()
  expect(getTelemetrySnapshot().cancellations).toBe(before + 1)
})
```

This tests that `countCancellation()` increments a counter. It does not test cancellation behavior in mounted components, concurrent mutations, or race conditions. It is a telemetry test, not a cancellation hardening test. The section name misrepresents its scope.

---

## 8. Premium UX Consistency Evaluation

Phase 33 claims all surfaces are "Consistent" with the established design language. The following items contradict that claim:

**CommandsSection error pattern:** Any async failure (toggle, delete, seed) replaces the entire section with a bare error string. This is not premium UX — it is destructive: the user loses access to all commands until page reload. An inline error banner with the command list still visible would be the minimum acceptable pattern.

**TelegramSection `confirm()` usage:** Line 178 uses `window.confirm()` for destructive disconnect. `confirm()` is synchronous, not styleable, blocked in some iframe/embedding contexts, and not accessible. This was not introduced by Phase 33, but the Phase 33 UX audit failed to flag it.

**CommandsSection emoji usage in buttons:** Lines 113–130 use emoji characters (`⏸`, `▶`, `✏️`, `🗑`) as icon-button labels without `aria-label` attributes. The `title` attribute is present but not sufficient for screen readers on buttons.

---

## 9. Feature Contract Testing Evaluation

**Claimed:** "21 tests across 6 sections" in `phase33-contracts.test.js`

**Actual:** 16 tests (verified by `grep -c "^    it("`)

| Section | Claimed | Actual | Discrepancy |
|---------|---------|--------|-------------|
| 1. Onboarding obeys orchestration | 2 | 2 | ✅ |
| 2. Product telemetry counters | 7 | 7 | ✅ |
| 3. Mounted-runtime stress patterns | 2 | 2 | ✅ |
| 4. Feature cancellation hardening | 1 | 1 | ✅ |
| 5. Feature contract tests | 1 | 1 | ✅ |
| 6. Performance integrity | 3 | 3 | ✅ |
| **Total in this file** | **21** | **16** | ❌ **-5** |

The Phase 33 Executive Summary overstates the test count by 5. The Section 11 changelog says "+16 novos including 5 retroativos" — which contradicts the "21 tests" in the executive section. The 16 count matches what is actually in the file. No tests appear to have been removed — the executive count was never accurate.

Additionally, test names do not consistently match the functions tested:

- **Test named** "resetPerformanceCounters clears all counters" **calls** `resetTelemetry()` (line 231), not `resetPerformanceCounters()`. These are different functions with different scopes: `resetTelemetry()` clears product counters; `resetPerformanceCounters()` clears render/timing/suspense counters. The test tests `resetTelemetry` but its name implies `resetPerformanceCounters`.

---

## 10. Runtime Performance Integrity Validation

Phase 33 adds:
- 2 new hook imports to `useOnboarding` (`useRuntimeOrchestration`)
- ~15 lines of logic inside `completeChecklistItem` and `dismissSurface`
- Module-level counter increments (O(1), no allocation)

**Rerender impact:** The `useRuntimeOrchestration` hook is already consumed by other components. Adding it to `useOnboarding` does not add a new subscription source — the provider already drives re-renders. No new rerender storms observed.

**Bundle size impact:** Confirmed negligible. `CommandsSection` bundle is 11.85 kB, `TelegramSection` is 9.64 kB. Diagnostics counter imports add no meaningful weight.

**Test suite timing:** 8.23s total, which is acceptable. However, the "all counters are bounded under MAX_COUNTER" test runs 2,001,200 counter increments in a tight loop. This is 10x the minimum needed to verify bounding. For a CI environment, this adds latency without additional signal.

---

## 11. `ui-overlay` Transition Architecture Assessment

`createEmptyTransitionMap()` in `runtimeOrchestration.js` defines the canonical set of transition kinds:

```js
function createEmptyTransitionMap() {
  return { route: null, tenant: null, auth: null, bootstrap: null }
}
```

`ui-overlay` is NOT in this map. The `TRANSITION_START` reducer handles arbitrary keys via `[action.payload.kind]` dynamic assignment, so `ui-overlay` works at runtime. However:

1. The initial state shape is incomplete — `activeTransitions` does not document this transition kind
2. The `AUTH_SYNC` reset path (line 150–154) rebuilds the map with `createEmptyTransitionMap()` plus `route`. Any active `ui-overlay` transition is silently dropped during authentication resets without calling `completeTransition` or `interruptTransition`. This means if a user is mid-dismiss during an auth reset, the orchestration state orphans the open transition.
3. Tools inspecting `createInitialRuntimeOrchestrationState().activeTransitions` would not discover that `ui-overlay` is a valid transition kind.

**Recommended fix:** Add `'ui-overlay': null` to `createEmptyTransitionMap()` and preserve it in the `AUTH_SYNC` reset path alongside `route`.

---

## 12. Architectural Sustainability Assessment

**Strengths:**

- The reducer model in `runtimeOrchestration.js` is deterministic and testable. Adding the `ui-overlay` transition kind to the map would complete it.
- The `committedStateRef` + serial queue pattern in `useOnboarding` is production-quality. The dual-update path (synchronous inside `patchState`, async via `useEffect`) is intentional and correct.
- `diagnostics.js` is well-separated from render logic. Counters are side-effect-only with no React dependencies.
- `traceAsyncFailure` with typed failure classes enables future filtering without schema changes.

**Weaknesses:**

- There is no test that exercises `countOnboardingDropOff()` via `dismissSurface()` — the only test of this counter calls it directly. The hook-level bug therefore escaped testing.
- Product telemetry has no export path beyond `getTelemetrySnapshot()`. As the surface area grows, there is no mechanism to ship these counters to any external system.
- `countOnboardingRetry()` is called in the `catch` block of the initial load effect — but it is labeled "retry," which implies re-execution. The initial failure is not a retry; it is a first-attempt failure. Semantically incorrect.
- No documentation for what constitutes an "overlay interruption" vs. a "drop-off." Both counters are incremented on every `dismissSurface()` call, so they are always equal in magnitude. This makes them redundant as currently defined.

---

## 13. Production-Readiness Evaluation

| Dimension | Status | Notes |
|-----------|--------|-------|
| Runtime stability | ✅ Solid | Phases 27–32 architecture is mature |
| Cancellation safety | ✅ Solid | Serial queue + cancelled flag |
| Tenant isolation | ✅ Solid | tenantId required for all mutations |
| Product telemetry accuracy | ❌ Broken | drop-off counter is dead |
| Telemetry coverage | ⚠️ Incomplete | disconnect failure, settings conflicts unwired |
| Orchestration correctness | ⚠️ Partial | ui-overlay not in initial map; transition completes on persistence failure |
| Test count accuracy | ❌ Inflated | 16 tests claimed as 21 |
| UX consistency | ⚠️ Overstated | Error replaces command list; confirm() in destructive actions |

---

## 14. Remaining Technical Debt

**Inherited from prior phases (unchanged):**
- `countSettingsSaveConflict()` exported but unimplemented
- `hasTelemetry()` semantically incorrect name
- `confirm()` dialogs in production destructive actions (6 locations)

**Introduced or made observable by Phase 33:**
- `countOnboardingDropOff()` permanently dead (state.checklist bug) — NEW
- `countTelegramIntegrationFailure()` missing from disconnect catch — NEW
- `ui-overlay` not in typed transition map — NEW (transition kind introduced without extending the map)
- Test "resetPerformanceCounters clears all counters" tests wrong function — NEW
- `completeOrchTransition` called regardless of persistence outcome — NEW
- `countOnboardingRetry()` semantically misnamed (counts load failure, not retry) — NEW
- `overlay_interruptions` and `onboarding_dropoff` are always equal under current logic — NEW

---

## 15. Risk Severity Classification

| Finding | Severity | Category |
|---------|----------|----------|
| `countOnboardingDropOff()` permanently dead (state.checklist bug) | HIGH | Functional bug in claimed deliverable |
| `ui-overlay` not in typed transition map; orphaned during AUTH_SYNC | MEDIUM | Architectural gap |
| TelegramSection disconnect catch unwired (4/5, not 5/5) | MEDIUM | Implementation vs. documentation gap |
| Test count inflation (16 vs. 21 claimed) | MEDIUM | Documentation integrity |
| `completeOrchTransition` fires on patchState failure | MEDIUM | Semantic incorrectness |
| Test "resetPerformanceCounters" tests wrong function | MEDIUM | Test correctness |
| `countOnboardingRetry()` semantic mismatch | LOW | Observability quality |
| `overlay_interruptions` ≡ `onboarding_dropoff` under current logic | LOW | Telemetry redundancy |
| `hasTelemetry()` misleading name | LOW | API ergonomics |
| Error replaces command list on toggle/delete failure | LOW | UX quality |
| Stress test "bounded" claim weaker than description | LOW | Test quality |
| `confirm()` in destructive actions (pre-existing) | LOW | UX/accessibility debt |

---

## 16. Whether Broader Feature Expansion Is Now Justified

**No. Not until the HIGH severity bug is fixed.**

The drop-off counter bug (`state.checklist`) is not a corner case — it is in the primary path of `dismissSurface()`, which is how users exit the onboarding panel. Phase 33's primary product-level deliverable is "onboarding telemetry." The drop-off counter is inoperative. Expansion on top of broken observability means future work will be flying blind on one of the core metrics.

**Conditionally yes, after:**

1. **Required before expansion:**
   - Fix `state.checklist → checklist` in `dismissSurface()` (10-minute fix)
   - Wire `countTelegramIntegrationFailure()` to the disconnect catch block (2-line fix)
   - Add `'ui-overlay': null` to `createEmptyTransitionMap()` and preserve it in AUTH_SYNC reset
   - Correct the test count documentation

2. **Strongly recommended before expansion:**
   - Fix test `resetPerformanceCounters clears all counters` to call `resetPerformanceCounters()` or rename the test
   - Add a test that exercises `countOnboardingDropOff()` via `dismissSurface()` on the rendered hook (not a direct call)
   - Decide whether `overlay_interruptions` and `onboarding_dropoff` should track different conditions (currently identical)

3. **Can defer to future phases:**
   - Wire `countSettingsSaveConflict()`
   - Replace `confirm()` with a modal component
   - Rename `hasTelemetry()` to `isBrowserContext()`
   - Add telemetry persistence/export path

The runtime foundation (Phases 27–32) is genuinely production-quality. The Phase 33 additions are partially correct. Expansion can proceed responsibly once the HIGH bug and two MEDIUM gaps are closed. Do not expand on the premise that Phase 33 is complete as documented — it is not.
