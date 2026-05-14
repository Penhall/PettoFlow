# PHASE 24 — Independent Runtime Audit

**Date:** 2026-05-14  
**Audited artifact:** `docs/PHASE_24_RUNTIME_STABILIZATION_AND_FUNCTIONAL_RECOVERY.md`  
**Audit stance:** hostile verification against actual code, not report narrative

## 1. Executive Assessment

The Phase 24 report is not trustworthy as written.

It did not stabilize the runtime. It closed a few surface symptoms, but the underlying runtime model is still fragile, several claimed fixes are only mitigations, and at least one larger class of runtime bugs was missed entirely.

The most serious miss is not subtle:

1. Multiple data hooks still have unstable effect dependencies and can refetch continuously.
2. Data ownership is fragmented across independent hook instances, so different surfaces can drift out of sync.
3. Onboarding mutations are still race-prone because the frontend sends full subtree replacements and the backend upserts last-write-wins snapshots.
4. The tenant fix still relies on a module singleton plus `localStorage` side-channel instead of explicit tenant ownership.
5. The app still lacks boundary coverage for shell-level and modal/lazy overlay failures.
6. The report’s regression claim is already false: `npm.cmd run lint` fails on a warning in a file changed by this phase.
7. The report’s test-status claim is not reproducible in the current workspace: `npm.cmd test` fails before execution with a Vitest/Vite temp-file `EPERM`.

Bottom line:

- `7/7 fixed` is false.
- `no regressions introduced` is false.
- `production-safe` is false.
- `premium architecture preserved` is only visually true. Runtime architecture is still compromised.

## 2. Verification Method

I audited the implementation directly in:

- `src/App.jsx`
- `src/context/TenantContext.jsx`
- `src/lib/activeTenant.js`
- `src/hooks/useOnboarding.js`
- `src/lib/onboardingApi.js`
- `supabase/functions/tenant-core/index.ts`
- `src/lib/diagnostics.js`
- `src/lib/lazyWithRetry.js`
- `src/components/shared/ViewErrorBoundary.jsx`
- `src/components/shared/CommandPalette.jsx`
- `src/components/shared/ReminderToast.jsx`
- `src/components/Tasks/TaskModal.jsx`
- `src/components/Calendar/CalendarView.jsx`
- `src/components/Activities/ActivitiesView.jsx`
- `src/components/Finance/FinanceView.jsx`
- `src/components/auth/ProtectedRoute.jsx`
- the shared resource hooks under `src/hooks/`

I also ran verification commands:

- `npm.cmd run build` — passed, chunk splitting still present.
- `npm.cmd run lint` — failed.
- `npm.cmd test` — failed to start because Vitest/Vite could not write `node_modules/.vite-temp/...` (`EPERM`).

## 3. Verification of Each Claimed Fix

| Claimed fix | Status | Evidence | Assessment |
|---|---|---|---|
| `activeTenant` child-before-parent fix | Partially effective, architecturally wrong | `src/lib/activeTenant.js`, `src/context/TenantContext.jsx`, `src/App.jsx:166`, `src/components/tenant/TenantGate.jsx` | The `localStorage` fallback masks one timing symptom. It does not remove the singleton authority problem. `App` still fires `fetchWorkspaceBootstrap()` unconditionally on mount, including the no-tenant path, and the request layer still depends on hidden global state. This is a mitigation, not a fix. |
| Onboarding stale closure elimination via `stateRef` | Not fixed | `src/hooks/useOnboarding.js:32-173`, `supabase/functions/tenant-core/index.ts:348-381` | `stateRef` only tracks the last committed render. Two async mutations started before the first response lands still compute from the same stale snapshot. The backend then upserts a full subtree snapshot with no versioning. Lost updates remain possible. |
| Tour auto-prompt effect dependency fix | Mostly fixed for the specific re-fire loop | `src/App.jsx:250-278` | Replacing the whole-object dependency with primitives is the correct local fix for that specific effect loop. It does not make onboarding state orchestration safe overall. |
| Initial workspace fetch cancellation | Partial | `src/App.jsx:166-185` | The local `cancelled` flag prevents stale state writes after unmount/StrictMode remount. It does not abort the request, does not guard missing tenant state, and does not fix the hidden global tenant dependency. |
| `handleTourComplete` error handling | Partial | `src/App.jsx:334-349` | The `try/catch` prevents an uncaught promise chain. It does not preserve consistency. If `updateTourState` succeeds and `completeChecklistItem` fails, the system still lands in a half-complete state. There is still no user-visible recovery path. |
| Visual fixture instability in `useActivities` | Narrow local fix only | `src/hooks/useActivities.js:7-18` | The memoization addresses one hook. The same unstable fixture/fallback pattern still exists across other hooks and is more damaging there. The phase fixed one instance of a broader defect class and left the class intact. |
| `navigator.platform` deprecation fix | Fine | `src/hooks/useCommandPalette.js:8-18` | This change is reasonable and low risk. It is not evidence of runtime stabilization. |

## 4. Hidden Findings the Report Missed

### P0 — Several shared data hooks still have unstable dependencies and can refetch continuously

This is the most serious miss in the entire phase.

The report fixed `useActivities`, but the same structural defect remains in:

- `src/hooks/useTransactions.js`
- `src/hooks/useAccounts.js`
- `src/hooks/useReceivables.js`
- `src/hooks/useActivityTemplates.js`
- `src/hooks/usePayees.js`
- `src/hooks/useFinRules.js`
- `src/hooks/useFinCategories.js`

Pattern:

- each hook calls `getVisualFixture('x', [])`
- in normal runtime, visual fixtures are absent
- the fallback `[]` is a new array each render
- that unstable reference is part of effect or callback dependencies
- the effect can rerun on every render

Examples:

- `src/hooks/useTransactions.js:13-50`
- `src/hooks/useAccounts.js:7-35`
- `src/hooks/useReceivables.js:8-31`
- `src/hooks/useActivityTemplates.js:8-31`
- `src/hooks/usePayees.js:7-34`
- `src/hooks/useFinRules.js:8-38`
- `src/hooks/useFinCategories.js:9-42`

This is not theoretical. It is a direct dependency bug. The same class of instability that was explicitly fixed in `useActivities` still exists in the rest of the data layer.

### P0 — `useTransactions` is doubly unstable

`src/hooks/useTransactions.js` is worse than the other hooks:

1. `fixtureTransactions` is unstable in non-visual mode.
2. the effect also depends on raw `filters`, even though `filtersKey` was introduced specifically to avoid unstable object dependencies.

That means calls like:

- `useTransactions()` in `src/components/Tasks/TaskModal.jsx`
- `useTransactions({}, rules)` in `src/components/Finance/FinanceView.jsx`
- `useTransactions({ relatedTo: ... })` in `src/components/Clients/ClientProfileModal.jsx`

can retrigger fetches continuously even when nothing meaningful changed.

This directly invalidates the report’s “performance integrity” and “runtime stabilized” claims.

### P1 — State ownership is fragmented across duplicate hook instances

The app does not have a shared source of truth for activities, receivables, transactions, accounts, or finance rules.

Examples:

- `src/App.jsx:135` uses `useActivities()` for reminders and command search.
- `src/components/Activities/ActivitiesView.jsx:39` uses a separate `useActivities()`.
- `src/components/Calendar/CalendarView.jsx:44` uses another `useActivities()`.
- `src/components/Finance/FinanceView.jsx:55` uses another `useActivities()`.
- `src/hooks/useCalendarEvents.js:24` uses yet another `useActivities()`.

Same problem exists for transactions and receivables.

This creates two failure modes:

1. data drift between surfaces
2. accidental “refresh by overfetching” behavior masking missing ownership

Examples of practical inconsistencies:

- adding an activity in `ActivitiesView` does not update `App`’s activity list used by `ReminderToast` and command search
- `FinanceView` uses two separate `useTransactions()` instances (`filtered` and `allTransactions`), so mutation paths do not have a coherent shared state
- `CalendarView` mutates one set of activity/receivable/transaction hooks while `useCalendarEvents()` renders events from separate hook instances

This is not a premium runtime architecture. It is local-state duplication held together by incidental refetching.

### P1 — `ProtectedRoute` can keep the app mounted after real auth loss

`src/components/auth/ProtectedRoute.jsx:14-31` permanently short-circuits to `children` once `everAuthenticated.current` becomes true.

That means:

- real sign-out can leave the app mounted instead of routing back to login
- auth loss can leave the shell alive while authenticated requests start failing
- tenant state and auth state can desynchronize under exactly the sort of runtime conditions this phase claimed to harden

This is a production reliability issue, not a cosmetic bug.

## 5. React Effect Ordering Safety

The report’s diagnosis of the child-before-parent passive effect ordering problem is directionally correct.

The solution is not.

Current behavior:

- tenant identity is still stored in a module singleton in `src/lib/activeTenant.js`
- `TenantContext` updates that singleton in an effect at `src/context/TenantContext.jsx:62`
- business requests still derive tenant identity implicitly in `src/lib/workspaceCore.js:32-33`
- `App` still boots workspace data unconditionally on mount at `src/App.jsx:166-185`

Why this is still unsafe:

1. The request layer still has an implicit runtime dependency instead of explicit tenant input.
2. The no-tenant onboarding path still mounts `App`, which still calls `fetchWorkspaceBootstrap()`, which still relies on `getRequiredActiveTenantId()`.
3. The fallback to `localStorage` is synchronous, but it is still a side-channel. It is not ownership.

Verdict:

- The fix is sufficient to reduce one deterministic first-mount failure in the single-path case.
- The architecture is still wrong.
- Calling this “safe under React 18” is not credible.

## 6. Stale Closure Elimination Assessment

The `stateRef` change in `src/hooks/useOnboarding.js` is not a true stale-update fix.

Why it fails:

1. `stateRef.current` updates only after React commits a render.
2. Two rapid async mutations started before the first response resolves still read the same old `stateRef.current`.
3. `patchState()` sends full subtree replacements, not merge deltas.
4. the backend in `supabase/functions/tenant-core/index.ts:366-381` reads current state, constructs a new full payload, and `upsert`s it with no version check.

That means all of the following are still possible:

- lost checklist updates
- out-of-order tutorial state overwrites
- dismiss-state overwrites
- last-writer-wins races across tabs
- last-writer-wins races across in-flight requests from the same tab

Verdict:

- This is a mitigation against a narrow single-render closure bug.
- It is not concurrency-safe.
- The report overstated it badly.

## 7. Suspense and Lazy-Loading Stability

### What is actually preserved

`npm.cmd run build` succeeded and still emitted split chunks for:

- `ActivitiesView`
- `FinanceView`
- `CalendarView`
- `TaskModal`
- `ReminderToast`
- `CommandPalette`
- `SettingsView`

So chunking was not collapsed back into eager loading.

### What is still unsafe

1. `ViewErrorBoundary` only protects the main tab content region in `src/App.jsx:847-851`.
2. `ReminderToast`, `CommandPalette`, and `TaskModal` are all lazy-loaded outside that boundary in `src/App.jsx:856-914`.
3. `OnboardingTour`, `AppShell`, `SidebarRail`, `Topbar`, and `ProfileMenu` are not covered by any root boundary.
4. `lazyWithRetry` still performs a forced page reload on first chunk failure in `src/lib/lazyWithRetry.js:24-35`.
5. After the reload retry is exhausted, overlay-area lazy failures are not recoverable by the local view boundary because they are outside it.

Assessment:

- Main content lazy loading is tolerable.
- Overlay and shell lazy/runtime failure handling is incomplete.
- The app can still crash outside the protected view region.

## 8. useEffect Dependency Correctness

### Confirmed good

- `src/App.jsx:258-278` no longer depends on the whole `onboarding` object for the tour auto-prompt effect.

### Still broken or weak

1. `src/hooks/useTransactions.js:50` still depends on raw `filters`.
2. all of the fixture-aware hooks listed earlier still depend on unstable fixture fallback references.
3. `src/components/admin/AuditPage.jsx:68` suppresses exhaustive-deps entirely.
4. `src/hooks/useCalendarEvents.js:137` suppresses exhaustive-deps and relies on manual keying.
5. `src/hooks/useActivities.js` now fails lint with an unnecessary dependency warning introduced by this phase.

Lint result:

```text
src/hooks/useActivities.js
13:79  warning  React Hook useMemo has an unnecessary dependency: 'visualMode'
```

Verdict:

- Dependency discipline improved in one place and remains poor in several others.
- The report’s general stabilization framing does not survive a repository-level hook audit.

## 9. Runtime Diagnostics Quality

`src/lib/diagnostics.js` exists.

It is also effectively dead.

Search result:

- there are no call sites for `traceRender`, `traceAsync`, `traceEffect`, `traceModal`, `traceSuspense`, `traceNavigation`, `traceContext`, `traceTenant`, `traceSnapshot`, or `diagWarn`

Implications:

1. There is no actual runtime tracing coverage.
2. There is no instrumentation at the exact boundaries the report claims were audited.
3. The diagnostics module currently contributes documentation theater, not observability.

Verdict:

- production-safe gating is irrelevant because nothing uses it
- diagnostics quality is shallow to the point of nonexistence

## 10. Concurrency and React 18 Safety

This codebase is not React 18 safe in the sense the report implies.

Confirmed partial improvements:

- the workspace bootstrap effect no longer blindly sets state after unmount
- the tour auto-prompt effect no longer reruns on every render because of whole-object dependency churn

Still unsafe:

1. Onboarding writes are last-write-wins.
2. Data hooks create multiple isolated state islands for the same resource.
3. Several hooks can refetch repeatedly because of unstable dependencies.
4. Tenant identity is still read implicitly through global state.
5. Auth and tenant routing can desynchronize because of `ProtectedRoute`.

This is not a minor cleanup issue. It means the runtime still depends on timing behavior and incidental refetches.

## 11. Error Boundary Assessment

### Confirmed

The report was correct that boundary coverage is incomplete.

### Actual scope gap

Protected by `ViewErrorBoundary`:

- only the active tab content under `renderContent()`

Not protected:

- `AppShell`
- `SidebarRail`
- `Topbar`
- `ProfileMenu`
- `ReminderToast`
- `CommandPalette`
- `TaskModal`
- `OnboardingTour`

Consequences:

- shell-level crashes still take down the entire app
- modal/lazy-overlay import failures can still take down the entire app
- retry behavior is inconsistent across content vs overlays

## 12. Performance Integrity Validation

### Preserved

- chunk splitting still exists
- there is no evidence that Phase 24 reintroduced eager bundling

### Broken

- runtime fetch amplification is still present
- render-triggered refetch loops are still present
- multiple isolated hook instances duplicate identical network work

This means the report’s “no performance regressions introduced” claim is not defensible.

The performance story is:

- bundle architecture mostly preserved
- runtime request behavior still unstable

That is not a pass.

## 13. Architectural Integrity

The stabilization work is tactical, not architectural.

The pattern is consistent:

1. symptom appears
2. local patch is added
3. underlying ownership problem is left in place

Examples:

- child-before-parent effect issue patched with `localStorage` fallback instead of explicit tenant flow
- stale onboarding writes patched with `stateRef` instead of request ordering/version control
- one unstable fixture hook patched while the same pattern remains in multiple sibling hooks
- unstable hook return object avoided in one effect using `onboardingRef`, while the hook itself still returns unstable mutators and state islands

Verdict:

- the premium UI architecture survived
- the runtime architecture did not get the same discipline
- hidden technical debt increased because workaround patterns were normalized

## 14. Production Reliability Assessment

Current state is not production-safe for a high-risk SaaS frontend.

Reasons:

1. unresolved request-loop risk in shared hooks
2. unresolved onboarding concurrency races
3. unresolved state ownership fragmentation
4. unresolved shell/modal boundary gaps
5. unverified test claims
6. lint failure in phase-touched code
7. auth-loss/sign-out routing weakness

If this build is already live and showing:

- elevated API traffic
- inconsistent finance/calendar/activity state
- logout weirdness
- onboarding state drift

then that behavior is consistent with the current code.

## 15. Risk Severity Classification

| Severity | Finding | Why it matters |
|---|---|---|
| P0 | Unstable dependency/refetch-loop class still present in multiple hooks | Can create continuous network churn and unstable runtime behavior |
| P0 | Onboarding write path still last-write-wins | State loss remains possible under rapid interaction or multi-tab use |
| P1 | Data ownership fragmented across separate hook instances | Cross-surface inconsistency and stale UI are still structurally built in |
| P1 | `ProtectedRoute` can keep app mounted after real auth loss | Users can remain inside a broken shell with failing authenticated requests |
| P1 | Overlay/shell areas still outside error boundaries | Single lazy/import/runtime failure can still crash the app |
| P2 | `handleTourComplete` catch only logs; no recovery or user feedback | Prevents crashes but not inconsistent onboarding state |
| P2 | Diagnostics module has zero call sites | Observability claim is effectively fake |
| P2 | Lint fails in phase-touched code | “No regressions” claim already disproven |
| P3 | `closePalette()` inside `startTransition` | UI consistency glitch risk remains |

## 16. Which Fixes Are Truly Robust vs Mitigations

### Robust enough for their narrow scope

- tour auto-prompt dependency narrowing in `src/App.jsx`
- command palette platform detection update in `src/hooks/useCommandPalette.js`

### Only mitigations

- `activeTenant` fallback via `localStorage`
- onboarding `stateRef`
- cancelled-flag bootstrap fetch
- `handleTourComplete` try/catch
- `useActivities` fixture memoization

The report treated most of those mitigations as completed fixes. That is not accurate.

## 17. Recommendations Before Future Feature Expansion

Do not expand feature scope on top of this runtime as-is.

Required follow-up work:

1. Remove implicit tenant authority from `activeTenant.js`. Pass tenant identity explicitly into business request helpers or bind it through a stable scoped client.
2. Replace full-subtree onboarding writes with versioned merge-safe updates. Add optimistic concurrency or server-side field-level merge semantics.
3. Fix the entire fixture-fallback dependency class across all hooks, not just `useActivities`.
4. Consolidate shared operational data into real shared ownership. Stop instantiating separate `useActivities`, `useTransactions`, `useReceivables`, `useAccounts`, and `useFinRules` state islands per surface.
5. Add a root error boundary and explicit boundaries for modal/overlay lazy regions.
6. Fix `ProtectedRoute` so real sign-out and real auth loss actually leave the protected shell.
7. Make verification real: fix the Vitest startup issue, restore lint cleanliness, and add tests for concurrency, auth transitions, and tenant bootstrap timing.

## 18. Rollback Assessment

A full visual architecture rollback is not automatically the best move.

The shell, chunk structure, and surface decomposition are salvageable.

But approving the current state as stable is not acceptable.

Practical recommendation:

- if this build is not yet broadly exposed, do not roll back the premium architecture; execute a hard runtime repair phase immediately
- if this build is already causing live operational instability or elevated backend load, rollback is justified until the request-loop and state-ownership problems are fixed

## 19. Suggested Follow-Up Phase

**Suggested next phase:** `PHASE_24A_RUNTIME_OWNERSHIP_AND_CONCURRENCY_REPAIR`

Scope:

1. Replace implicit tenant globals with explicit tenant-scoped request ownership.
2. Rebuild onboarding mutations around merge-safe/versioned writes.
3. Eliminate unstable fixture fallback dependencies across all hooks.
4. Centralize activities/transactions/receivables/accounts/rules into shared state ownership.
5. Add root and overlay error boundaries.
6. Repair auth-loss/sign-out routing.
7. Restore `lint` and make `test` reproducible in CI and local environments.
8. Add targeted tests for:
   - rapid repeated onboarding mutations
   - out-of-order onboarding responses
   - no-tenant app mount
   - tenant switch during in-flight requests
   - sign-out/auth-loss routing
   - overlay lazy import failure containment

## 20. Final Verdict

Phase 24 should not be accepted as “runtime stabilization completed.”

The honest assessment is:

- some local symptoms were reduced
- the underlying runtime is still fragile
- several fixes are workarounds
- at least one major defect class was missed entirely
- the app is still not safe to treat as operationally hardened under React 18

This is not a finished stabilization phase.
