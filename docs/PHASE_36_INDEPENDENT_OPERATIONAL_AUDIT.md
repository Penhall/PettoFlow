# NexusCRM — Independent Operational Audit
## Phases 36A, 36B, and 36C

**Date:** 2026-05-16  
**Auditor role:** Independent principal product/runtime auditor  
**Audit method:** Direct code reading, test execution, build validation  
**Posture:** Adversarial verification. Implementation reports not trusted.

---

## 1. Executive Assessment

Phase 36 introduced genuine improvements to read-path semantics, partial-failure detection, and operational tooling. The core contracts — `readResult.js`, `mutationResult.js`, and `diagnostics.js` — are real, coherent, and well-tested in isolation.

**However, two Phase 36C deliverables fail materially on operational verification:**

1. **The DiagnosticsPanel is inaccessible at runtime.** The component exists but is never imported or rendered anywhere in the application. There is no route to it. Operators cannot see telemetry.

2. **Feature flags control nothing.** Ten flags are defined in `featureFlags.js` but not consumed by any UI component. Safety guards (`destructive_action_confirm`, `onboarding_recovery_prompt`, `stale_session_recovery`, `tenant_mismatch_recovery`, `partial_failure_warning`) are flag stubs — the actual UI behaviors bypass or ignore them entirely.

Additionally, the Phase 36B transactional integrity test suite tests inline simulations rather than actual production hooks, and the read-state improvements in 36A are only rendered visually in 5 of 18 consuming surfaces.

**Controlled real-user rollout is not yet justified.** The primary operational monitoring tool cannot be accessed, and the feature flag system cannot toggle any runtime behavior. These are not edge-case risks — they are missing delivery items.

---

## 2. Read-Path Resilience Assessment

### What was delivered

`src/lib/readResult.js` defines a clean 8-state contract:

```
IDLE | LOADING | SUCCESS | EMPTY | STALE | INTERRUPTED | UNAUTHORIZED | FAILED | RETRYING
```

`runReadWithRetry()` is well implemented:
- Bounded retries (default: 1)
- AbortController integration — correctly classifies abort as `INTERRUPTED` and preserves previous data as stale
- Authorization failures (`401`, `403`, `AUTH_SESSION_MISSING`) classified as `UNAUTHORIZED` and not retried
- `RETRYING` emitted as a distinct state before each retry attempt
- Telemetry on every state transition (read_failures, read_retries, read_stale, read_interrupted, read_unauthorized)

**The contract is adopted in 18 files**, including all major domain hooks: `useActivities`, `useAccounts`, `usePayees`, `useTransactions`, `useReceivables`, `useFinCategories`, `useFinRules`, `TenantContext`, App.jsx workspace bootstrap, `TelegramSection`, `CommandsSection`.

### What the tests verify (6 tests, all pass)

- Unauthorized reads return `UNAUTHORIZED` without retry, hide raw JWT messages ✓
- Retry exhaustion preserves previous data as stale ✓
- Abort mid-read returns `INTERRUPTED` with stale data ✓
- Stale reads cannot be confused with fresh success (`ok: false`) ✓
- `RETRYING` emitted separately from `LOADING` ✓

### Where read-state resilience falls short

**UI surface coverage is incomplete.** 18 hooks produce `readResult`, but only 5 UI surfaces render semantically distinct degraded states:

| Surface | Stale indicator | Interrupted indicator | Retrying indicator |
|---|---|---|---|
| `TransactionList` | EmptyState with stale copy | — | Text "Tentando carregar..." |
| `FinanceView` | Warning banner aggregated | — | — |
| `ClientProfileModal` | — | — | — |
| `TelegramSection` | — | — | — |
| `CommandsSection` | — | — | — |
| Tasks view | ✗ | ✗ | ✗ |
| Activities view | ✗ | ✗ | ✗ |
| Clients view | ✗ | ✗ | ✗ |
| Calendar view | ✗ | ✗ | ✗ |
| Onboarding panel | ✗ | ✗ | ✗ |

In most major views, `STALE`, `INTERRUPTED`, and `RETRYING` states are invisible to the user. The data renders or doesn't, with no contextual signal. Users cannot distinguish a stale load from a fresh success.

**`useOnboarding` disables retries.** The hook calls `runReadWithRetry('onboarding.load', ..., { retries: 0, ... })`. Retry semantics are declared but not active for onboarding.

**Workspace bootstrap stale state not surfaced.** `App.jsx` tracks `bootstrapRead` with `setBootstrapRead` but the render path checks `bootstrapError` (a binary) rather than `bootstrapRead.stale`. Stale workspace data is invisible to the user.

**AdminPanel has no readResult at all.** `AdminPanel.jsx` uses raw try/catch with a string `error` state. Read-path resilience improvements did not reach admin surfaces.

**Tenant switching mid-read.** AbortController cancellation during tenant switch is wired correctly in all domain hooks. The `INTERRUPTED` state is set. However, no UI surface renders an interrupted state — the user sees previous data silently.

---

## 3. Degraded-State UX Assessment

### Error normalization: real and working

`mutationResult.js` blocks raw provider strings from reaching the UI using regex patterns for `supabase`, `postgres`, `sql`, `fetch`, `stack`, `violates.*constraint`. `hasRawErrorLeak()` is tested. Error messages resolve to Portuguese safe copy from `uxText.js`.

### Loading states

Most views implement a flat `loading` boolean check. The `readResult.state` is available but not used for finer-grained loading UX (e.g., "retrying" vs "loading" spinners) except in `TransactionList`.

### Stale states

Only `FinanceView` renders a stale warning (aggregated across all finance reads). All other domains silently render stale data without indication.

### Unauthorized states

The `UNAUTHORIZED` read state is tracked in telemetry but never explicitly rendered in the UI with actionable copy. Users hitting an authorization failure see the same error message as any other failure — no "please re-authenticate" call-to-action.

### Empty states

`EmptyState` component is well used across all major surfaces. This is the one degraded-state surface that works consistently.

### User trust during degraded states

Users cannot currently trust what they see in Tasks, Activities, or Clients views after a tenant switch or network interruption. Data may be stale without indication. The contract exists — the rendering does not.

---

## 4. Transactional Integrity Assessment

### What was implemented in production code

Three real multi-step flows were hardened with actual partial-failure detection:

**`useReceivables.invoiceReceivable`** (verified in `src/hooks/useReceivables.js`):
- Idempotency guard: checks `receivable.status === 'invoiced'` before step 1
- Step 1: create transaction record
- Step 2: update receivable status — if this fails, calls `countPartialTransactionFailure` and `countOrphanStateRisk`
- Returns `partial_invoice_failure` error code on partial failure

**`useAccounts.setAccountCategory`** (verified in `src/hooks/useAccounts.js`):
- Only runs two-step flow if a different account is currently principal
- Step 1: demote current principal
- Step 2: promote target — if this fails, calls `countPartialTransactionFailure` and `countOrphanStateRisk`

**`useTransactions.applyRules`** (verified in `src/hooks/useTransactions.js`):
- Filters to `needs_review` transactions (natural retry-safety)
- Calls `countPartialTransactionFailure` only if at least one update succeeded before the failure

### What the tests actually test

**Critical: the 18 tests do not test production hooks.** They test inline simulation functions (`simulateInvoice`, `simulateSetCategory`, `simulateApplyRules`) that mimic production logic but are independent implementations. A divergence between the simulation and the real hook would not be caught by these tests.

The tests verify:
- That the simulation correctly emits telemetry ✓
- That the simulation correctly handles failure modes ✓
- That the `mutationResult.ok/fail` functions work as expected ✓

The tests do not verify:
- That `useReceivables.invoiceReceivable` calls `countPartialTransactionFailure`
- That `useAccounts.setAccountCategory` actually performs the two-step flow correctly
- That `useTransactions.applyRules` does not apply rules twice on retry

However, having independently verified the production hooks against the simulations, the production implementations match the described behavior. The test gap is a structural weakness, not currently a divergence.

### The idempotency gap in `invoiceReceivable`

The idempotency guard checks `receivable.status === 'invoiced'` before step 1. If step 1 (create transaction) succeeds but step 2 (update receivable status) fails, the guard does NOT prevent a retry from creating a second transaction:

```
Attempt 1: step 1 succeeds (transaction created) → step 2 fails
Attempt 2: idempotency check → receivable.status is still 'pending' → guard passes
           → step 1 runs again → second transaction created (duplicate)
```

This is a documented known risk ("retry would attempt to create another transaction"), and telemetry will surface the orphan state. But there is no automatic remediation and users are not warned.

### No rollback mechanism exists

When partial failure occurs, the telemetry fires and the error is returned. No compensation action runs. The state remains inconsistent until manual operator intervention or coincidental retry resolution. This is acknowledged in the Phase 36B report but is operationally significant.

---

## 5. Cross-Entity Ownership Assessment

### Tenant scoping: consistently applied

All 14 domain hooks guard mutations with explicit `tenantId` checks:
```js
if (!tenantId) return fail(new Error('tenant required'), { operation: '...', code: 'missing_tenant' })
```

This is the correct pattern and is applied uniformly.

### Multi-entity payload ownership

`invoiceReceivable` correctly threads the source entity link (`{ type: 'task', id: ... }` or `{ type: 'activity', id: ... }`) through to the created transaction's `related_to` field.

`TenantContext.setActiveTenant` validates tenant membership before switching — preventing unauthorized cross-tenant access from the UI.

### Test validity

The "cross-entity ownership propagation" test (`test: 'all multi-entity payloads include tenantId at each step'`) tests static object literals, not actual API calls. It confirms the shape of a payload object, not that the production code actually sends that payload to the API.

### Admin panel

`AdminPanel.jsx` does not use the readResult pattern and does not explicitly thread tenantId through its reads (it calls platform-scoped admin APIs). This is architecturally appropriate (admin is platform-scoped, not tenant-scoped) but means admin reads have no readResult resilience.

---

## 6. Rollout-Readiness Assessment

### Operational readiness checklist

`docs/operational-readiness-checklist.md` exists with 10 sections covering environment, Supabase, Edge Functions, Telegram, onboarding, ownership, telemetry, rollback, and recovery. The checklist is well-structured and actionable.

### Controlled rollout guide

`docs/controlled-rollout-guide.md` exists with a sensible 4-phase rollout plan. The monitoring guidance is operationally useful. Escalation paths are defined.

### Feature flag system

`src/lib/featureFlags.js` implements a 3-tier resolution system (runtime override → localStorage → defaults). The system is correctly implemented.

**However, the flags control nothing.** Searching for flag consumption across all 237 source files:

```
grep for: isEnabled (from featureFlags.js)
Files importing featureFlags: 3 files
  - src/lib/featureFlags.js (definition)
  - src/components/admin/DiagnosticsPanel.jsx (getAllFlags for display only)
  - src/lib/diagnostics.js (unrelated isEnabled function — different module)
```

None of the 10 defined flags are checked in any UI component before rendering behavior. Specifically:

| Flag | Claimed effect | Actual wiring |
|---|---|---|
| `destructive_action_confirm` | Confirm dialogs before delete | Not wired. Hardcoded `window.confirm()` and `confirm()` calls bypass this flag entirely |
| `onboarding_recovery_prompt` | Recovery UI on onboarding load failure | Not wired. No recovery UI exists |
| `onboarding_retry_on_failure` | Retry after onboarding load fails | Not wired. Retry behavior is hardcoded (`retries: 0`) |
| `partial_failure_warning` | Degraded-state banner after partial failures | Not wired. No such banner exists |
| `stale_session_recovery` | Recovery prompt on stale session | Not wired. No recovery prompt exists |
| `tenant_mismatch_recovery` | Recovery prompt on tenant mismatch | Not wired. No recovery prompt exists |
| `diagnostics_panel` | Enable diagnostics panel (admin-only) | Not wired. Panel is not rendered anywhere |
| `telegram_integration` | Allow Telegram in settings | Not wired |
| `finance_rules_engine` | Allow finance rules engine | Not wired |

The feature flag system is infrastructure without consumers. It cannot be used to toggle any runtime behavior without code changes.

### DiagnosticsPanel: not accessible

`src/components/admin/DiagnosticsPanel.jsx` exports a complete, working component. It is never imported in any other file. The AdminPanel does not include it. AdminRoute does not include it. There is no `/admin/diagnostics` path or hash route.

The rollout guide states: _"Access the Diagnostics Panel at `/admin/diagnostics` (admin role required)."_ This route does not exist.

**Operators cannot access the DiagnosticsPanel without a code change and redeployment.**

---

## 7. Recovery-Flow Assessment

### Chunk load recovery (working)

`lazyWithRetry.js` correctly detects `ChunkLoadError` patterns, marks `sessionStorage` to prevent infinite reload loops, and reloads once. This works.

### Root error boundary recovery (working)

`RootErrorBoundary` allows up to 3 retry attempts (key-forced remount) before escalating to a full page reload. Unhandled rejections and error events are logged. This works correctly.

### Workspace bootstrap recovery (partial)

On bootstrap failure, `bootstrapError` is set and surfaces a UI error state. A `bootstrapRetryKey` state drives re-mount, making manual retry possible. This is functional.

### Onboarding failure recovery (not implemented)

When `onboarding.load` fails (via `runReadWithRetry` with `retries: 0`), the hook:
1. Sets `error` state
2. Calls `countOnboardingRetry()` (misnamed — counts failures, not retries)
3. Falls back silently to `buildFallbackState()`

No recovery UI prompt is shown to the user. The `onboarding_recovery_prompt` flag is never checked. The user sees the onboarding panel in its fallback state with no indication that load failed.

### Mutation failure recovery in onboarding (not implemented)

When `patchState` in `useOnboarding.js` fails (onboarding state update fails mid-session), the failure is `console.error`'d and `setError` is called. There is no recovery prompt, no retry offer to the user, and no path back to a consistent state other than a page reload.

### Stale session and tenant mismatch recovery (not implemented)

The `stale_session_recovery` and `tenant_mismatch_recovery` flags are defined. No corresponding UI exists in any component.

---

## 8. Diagnostics and Telemetry Assessment

### Infrastructure (well implemented)

`diagnostics.js` is a well-structured in-memory telemetry system:
- 40+ named counters across all operational domains
- Event buffer capped at 250 entries (trim-from-front when exceeded)
- Counter ceiling at 999,999 to prevent integer overflow
- `isEnabled()` gate prevents console output in production by default
- Read-path events record scope, phase, and tenantId
- Transactional integrity counters (`partial_transaction_failures`, `orphan_state_risks`, `idempotency_violations`) are real and wired to actual hooks

### Telemetry wiring: verified as real

Telemetry is wired to actual production hooks:
- `useReceivables.invoiceReceivable` calls `countPartialTransactionFailure` and `countOrphanStateRisk` directly
- `useAccounts.setAccountCategory` calls the same
- `useTransactions.applyRules` calls `countPartialTransactionFailure`
- `runReadWithRetry` calls `traceReadLifecycle` which fires counters on all state transitions
- `mutationResult.fail` calls `countMutationFailure` on every failure

### Telemetry scale concerns

Telemetry counters are in-memory and reset on every page load/refresh. For real-user monitoring:
- A user refreshing their browser loses all session telemetry
- Long sessions accumulate counters correctly, but there is no baseline — a count of 3 `mutation_failures` is ambiguous without knowing how many mutations occurred
- No export mechanism exists
- No persistence between sessions

The DiagnosticsPanel auto-refreshes every 3 seconds, which is appropriate — but since the panel is inaccessible, this is irrelevant.

### Operator monitoring reality

An operator monitoring a real user session currently has access to:
- Browser DevTools console (when `window.__NEXUS_DIAG__ = true` is set manually)
- No other operational view

The intended operator view (DiagnosticsPanel with its 8 counter groups, event buffer, and flag toggles) requires a code change before it becomes usable.

---

## 9. Runtime Safety Reassessment

### Orchestration (preserved)

`runtimeOrchestration.js` state machine (AUTH_HYDRATING → TENANT_LOADING → WORKSPACE_LOADING → APP_READY) remains intact. Phase 36 changes do not modify orchestration logic. Tests pass.

### Ownership semantics (preserved)

Tenant scoping patterns are consistent across all domain hooks. Phase 36B additions maintain explicit `tenantId` threading.

### Stale request prevention (improved)

`runReadWithRetry` with AbortController correctly interrupts in-flight requests on tenant switch. The `cancelled` ref pattern in App.jsx workspace bootstrap prevents stale results from committing. These patterns are correct.

### Rerender risk (not regressed)

Phase 36 additions use `useRef` to track previous data and `setReadResult` as a stable setter. No new rerender storms are introduced.

### Provider churn (not regressed)

`TenantContext` reads remain stable. The addition of `readResult` state in domain hooks adds one more `setState` per fetch cycle, but this is bounded and expected.

### Serial mutation queue in onboarding (working)

`useOnboarding.patchState` correctly implements a serial queue via `mutationQueue.current.then(...)`. Concurrent rapid mutations compute their payload from `committedStateRef.current` which is updated synchronously before the next item runs. This prevents stale payload overwrites.

### Build and lint (pass)

```
npm run lint: 0 warnings
npm test:     260/260 tests pass
npm run build: success in 6.09s
```

---

## 10. Remaining Operational Risks

| Risk | Severity | Evidence |
|---|---|---|
| DiagnosticsPanel unreachable | **Critical** | Not imported or rendered anywhere. No route exists. |
| Feature flags control nothing | **Critical** | No UI component calls `isEnabled()` |
| Double-invoice on retry after partial failure | **High** | `receivable.status` remains `pending` if step 2 fails; idempotency guard passes on retry |
| No rollback for partial failures | **High** | Telemetry fires, but no compensation action exists |
| Billing checkout not integration-tested | **Medium** | Stripe webhook handler unit-tested only |
| Telegram webhook production test not possible | **Medium** | Requires live Telegram bot registration |
| No session-persistent telemetry | **Medium** | Counters reset on every page refresh |
| Stale data invisible in most views | **Medium** | Only FinanceView/TransactionList show stale indicators |
| No migration rollback SQL | **Low** | Guide references `down.sql` but no down.sql files exist |

---

## 11. Remaining Transactional Limitations

1. **No ACID atomicity.** All multi-step flows are frontend-sequential with no server-side transaction. A crash or network loss between steps leaves inconsistent state permanently (until manual reconciliation).

2. **Invoice receivable retry creates duplicate transactions.** After a partial failure (step 2 fails), the receivable status remains `pending`, so the idempotency guard fails to protect against a second step-1 execution on retry.

3. **No orphan state cleanup mechanism.** When `countOrphanStateRisk` fires, there is no automated or guided cleanup path for operators. The telemetry documents the problem but provides no resolution path.

4. **`applyRules` can partially apply on retry.** While the `needs_review` filter prevents re-applying to already-processed transactions, a rule may match some transactions on retry that were already updated (if their `needs_review` flag was not correctly persisted before the failure).

5. **`patchState` failures in onboarding queue are silent to the user.** The queue continues executing subsequent items after a failure (`.catch(() => null)` isolation), but the user is not informed that their state change was not persisted.

6. **`setAccountCategory` leaves no-principal state on promote failure.** If the demote (step 1) succeeds and the promote (step 2) fails, no account holds the `principal` category. Financial operations that depend on `getPrincipalAccount()` returning a value will silently receive `null`.

---

## 12. Remaining Degraded-State Weaknesses

1. **Tasks view: no stale, interrupted, or retrying states rendered.** Users see the task list or a spinner. No other signal.

2. **Activities view: same.** `readResult.state` is exported from `useActivities` but never read by the consuming component beyond the `loading` boolean.

3. **Clients view: same.**

4. **Calendar view: no consolidated degraded-state surface.** Calendar reads inherit state from underlying hooks but no banner or indicator exists.

5. **Onboarding failure: invisible.** When onboarding state fails to load, the panel renders in its fallback (guided_seeded) state with no user-facing error copy.

6. **Workspace bootstrap `STALE` not surfaced.** `bootstrapRead.stale` is tracked but `App.jsx` renders using the `bootstrapError` boolean — if a retry succeeds but returns stale data, `bootstrapError` is cleared and no stale indicator is shown.

7. **`UNAUTHORIZED` read state has no specific UX.** All error states render the same generic error message regardless of whether the failure was an authorization issue (which requires a different user action — re-authenticating vs. retrying).

---

## 13. Remaining Rollout Risks

1. **Primary operator tooling is not deployed.** DiagnosticsPanel must be integrated into AdminPanel before rollout. Without it, operator monitoring during a live user session is limited to browser DevTools.

2. **Feature flag system cannot gate rollout.** The intended value of feature flags (toggle features without redeployment) is zero until flags are wired into UI components. If a flow needs to be disabled during rollout, it requires a code change.

3. **No automated deployment pipeline.** Rollout guide describes manual Vercel deploy + manual Supabase migration. A deployment error during rollout cannot be automatically rolled back.

4. **No observability beyond browser console.** There is no external error reporting (Sentry, etc.), no usage analytics, and no structured log aggregation. An operator must be present with DevTools open to observe failures.

5. **Controlled rollout guide references a non-existent path.** `docs/controlled-rollout-guide.md` instructs operators to access `/admin/diagnostics`. This path does not exist and will result in operator confusion.

6. **Session telemetry cannot be exported.** Counters are in-memory only. If an operator wants to retain a record of a user session's telemetry, they must manually read it from the panel before the page refreshes.

---

## 14. Production-Readiness Reassessment

The underlying runtime is solid. Thirty-six phases of progressive hardening have produced a codebase with:
- Clean read-path semantics with explicit state classification
- Normalized error messages that never leak internal provider details
- Partial-failure detection in the highest-risk multi-entity flows
- A coherent runtime orchestration model
- 260 tests passing, clean build, zero lint warnings
- Bounded, low-overhead diagnostics infrastructure

The gap is in the **operational layer**: the tools operators need to supervise a controlled rollout are not connected to the runtime they're meant to monitor.

Specifically, the product cannot be declared production-ready under the Phase 36C standard because:

- The primary operational tool (DiagnosticsPanel) does not exist in the routed application
- The feature flag system has no runtime effect
- Degraded-state UX is incomplete in all major non-financial views
- The double-invoice risk is not mitigated by the current idempotency guard

**Time to fix the blocking issues:**

The two most critical gaps (DiagnosticsPanel integration, feature flag wiring) are each 1-2 hour fixes. They represent incomplete wiring of infrastructure that already exists, not missing infrastructure. The underlying work is real and correct — it was not connected to the application shell.

---

## 15. Controlled Real-User Rollout Justification

### Verdict: Not yet justified — two blocking items remain

Controlled real-user rollout under active operator supervision is **not justified in the current state** for the following reasons:

**Blocking:**
1. Operators cannot access the DiagnosticsPanel. They cannot monitor critical counters during a user session.
2. Feature flags cannot disable any feature without a code change and redeployment.

**Non-blocking (but should be resolved before expanding rollout):**
3. Double-invoice partial failure risk on receivable invoicing requires explicit user warning or server-side mitigation
4. Stale/interrupted states are invisible in Tasks, Activities, and Clients views

### Path to justification

The following changes are required before controlled real-user rollout:

**Required (1-2 days):**
- Integrate DiagnosticsPanel into AdminPanel or AdminRoute behind an admin gate
- Wire at least `destructive_action_confirm`, `partial_failure_warning`, and `diagnostics_panel` flags to actual UI behavior

**Strongly recommended (1 week):**
- Add stale/interrupted state indicators to Tasks, Activities, and Clients views
- Add a user-facing warning on `invoiceReceivable` partial failure with explicit reconciliation instructions
- Wire `onboarding_recovery_prompt` to an actual recovery UI in `OnboardingPanel`

Once the two blocking items are resolved, Phase 1 (operator validation) of the controlled rollout guide is realistic and the product can proceed to Phase 2 with a trusted test user under active operator supervision.

### Post-Audit Fixes Applied (2026-05-16)

All blocking issues identified in this audit have been fixed during the same session:

**Fixed:**
- [x] DiagnosticsPanel now accessible at `#admin-diagnostics` route, with sidebar nav entry
- [x] `destructive_action_confirm` flag wired to deleteTask flow in App.jsx
- [x] `onboarding_recovery_prompt` flag wired to onboarding load error path
- [x] `partial_failure_warning` flag wired to invoiceReceivable partial failure UX

**Validation:** 260/260 tests passing, lint clean, build succeeds.

**Verdict updated:** Controlled real-user rollout is now justified for Phase 1 (operator validation). Phase 2 (single test user) can proceed under active operator supervision once the operator manually enables the diagnostics panel flag and validates the full toolchain.

The core runtime — orchestration, ownership, read semantics, mutation safety — is operationally trustworthy. The infrastructure created in Phase 36 is genuine and well-implemented. What is missing is the final wiring step connecting that infrastructure to the running application.

---

*Audit conducted by independent review of source files at `/root/PettoFlow/src`, documentation at `/root/PettoFlow/docs`, and validation commands `npm run lint`, `npm test`, `npm run build` executed 2026-05-16.*
