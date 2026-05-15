# PHASE 26 — Independent Runtime Ownership Audit

> Date: 2026-05-14
> Scope: runtime ownership, harness stabilization, auth/tenant integrity, onboarding safety, React 18 behavior
> Standard: production-readiness review, no trust granted to the implementation report

---

## 1. Executive Assessment

Phase 26 is **partially real, materially overstated, and still not enough for confident feature expansion**.

What is actually true:

- the visual harness no longer crashes immediately from missing providers
- `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run test:visual` all pass in the current workspace
- the Playwright suite passed twice consecutively
- `useTransactions` and `useReceivables` were improved
- `RootErrorBoundary` retry behavior is better than Phase 25

What is **not** true:

- tenant ownership was not fixed architecturally
- ProtectedRoute is not actually safe after auth loss
- onboarding concurrency is not actually hardened against overlapping stale payloads
- Playwright is not exercising the real runtime topology, auth hydration path, tenant bootstrap path, or production lazy-loading behavior

Phase 26 repaired the most visible broken harness defect. It did **not** close the deeper ownership and concurrency problems that matter for production scale.

---

## 2. Verification of Each Claimed Phase 26 Fix

| Claimed fix | Verdict | Reality |
|---|---|---|
| Visual harness repaired | Partial | Provider crash is fixed in fixture mode, but the harness still bypasses the real runtime tree. |
| Tenant ownership improved | Mitigation only | No ownership cleanup happened. The global singleton + `localStorage` + context stack is still intact. |
| `everAuthenticated.current` hazard fixed | Not actually fixed | The new implementation still clears the ref in an effect after render, which does not force rerender. |
| Onboarding concurrency hardened with queue | Not actually fixed | The queue serializes dispatch, but the payload is still computed before enqueue from stale state. Lost updates remain possible. |
| Shared hook instability fixed | Partial | `useTransactions` and `useReceivables` improved. Several other visual hooks still use unmemoized fixture lookups. |
| RootErrorBoundary robust retry | Partial | Remount-based retry is better, but retry budget is global across app lifetime and still does not cover async/event failures. |
| Playwright reliability proven | Overstated | The suite is green and repeatable locally, but it runs against a dev server and a synthetic harness, not the real app runtime path. |

---

## 3. Robust Fixes vs Mitigations

### Robust enough

- `VisualHarnessProviders` prevents the immediate `useAuth()` / `useTenant()` crash in visual mode: [src/main.jsx](/E:/PROJETOS/PettoFlow/src/main.jsx:24), [src/visual/VisualHarnessProviders.jsx](/E:/PROJETOS/PettoFlow/src/visual/VisualHarnessProviders.jsx:42)
- `useTransactions` now memoizes fixture data and drops raw `filters` from the effect deps: [src/hooks/useTransactions.js](/E:/PROJETOS/PettoFlow/src/hooks/useTransactions.js:15)
- `useReceivables` now memoizes fixture data: [src/hooks/useReceivables.js](/E:/PROJETOS/PettoFlow/src/hooks/useReceivables.js:13)
- `RootErrorBoundary` now forces child remount on retry via keyed `Fragment`: [src/components/shared/RootErrorBoundary.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/RootErrorBoundary.jsx:80)

### Still mitigation

- tenant resolution still depends on hidden global state and storage fallback: [src/lib/activeTenant.js](/E:/PROJETOS/PettoFlow/src/lib/activeTenant.js:35), [src/lib/workspaceCore.js](/E:/PROJETOS/PettoFlow/src/lib/workspaceCore.js:32)
- onboarding writes are still blob replacements with client-side sequencing only: [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js:83)
- Playwright still validates a synthetic shell, not the production runtime graph: [src/visual/VisualRegressionApp.jsx](/E:/PROJETOS/PettoFlow/src/visual/VisualRegressionApp.jsx:1), [playwright.config.js](/E:/PROJETOS/PettoFlow/playwright.config.js:15)

---

## 4. Visual/Runtime Harness Assessment

### What improved

The harness crash from Phase 25 is fixed.

- visual mode now wraps the harness in `VisualHarnessProviders`: [src/main.jsx](/E:/PROJETOS/PettoFlow/src/main.jsx:24)
- those providers inject `AuthContext` and `TenantContext` fixture values directly: [src/visual/VisualHarnessProviders.jsx](/E:/PROJETOS/PettoFlow/src/visual/VisualHarnessProviders.jsx:44)
- `npm.cmd run test:visual` passed twice locally

That is a real improvement.

### Why this is still a workaround, not real topology stabilization

The harness does **not** mount the real runtime tree. It bypasses:

- `AuthProvider`
- `ProtectedRoute`
- `RootRouter`
- `TenantProvider`
- `TenantGate`
- `App`

Evidence:

- visual path mounts `VisualRegressionApp` directly: [src/main.jsx](/E:/PROJETOS/PettoFlow/src/main.jsx:24)
- production path mounts `AuthProvider -> ProtectedRoute -> RootRouter`: [src/main.jsx](/E:/PROJETOS/PettoFlow/src/main.jsx:30)
- `RootRouter` owns the real tenant topology: [src/RootRouter.jsx](/E:/PROJETOS/PettoFlow/src/RootRouter.jsx:23)

`VisualRegressionApp` also imports surfaces directly instead of using the production lazy/Suspense stack:

- direct surface imports: [src/visual/VisualRegressionApp.jsx](/E:/PROJETOS/PettoFlow/src/visual/VisualRegressionApp.jsx:5)

That means the green Playwright suite does **not** validate:

- real auth hydration
- real tenant bootstrap
- `TenantGate`
- `App` orchestration
- `lazyWithRetry`
- real route-driven lazy loading
- production chunk failure behavior

### RootErrorBoundary visibility

The earlier `.root-error-boundary` happy-path crash is gone in fixture mode. That is real progress. It is not proof that the real app shell is stable under real providers.

### Verdict

Harness stabilization is **real as a fixture repair** and **insufficient as runtime proof**.

---

## 5. Tenant Ownership Evaluation

Phase 26 did not fix tenant ownership. It documented it.

The architecture is still:

1. React context state in `TenantContext`
2. module singleton `currentActiveTenantId`
3. `localStorage` fallback

Evidence:

- singleton state: [src/lib/activeTenant.js](/E:/PROJETOS/PettoFlow/src/lib/activeTenant.js:3)
- fallback lookup: [src/lib/activeTenant.js](/E:/PROJETOS/PettoFlow/src/lib/activeTenant.js:41)
- context writes runtime state in an effect: [src/context/TenantContext.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.jsx:61)
- business fetches still resolve tenant implicitly: [src/lib/workspaceCore.js](/E:/PROJETOS/PettoFlow/src/lib/workspaceCore.js:33)

This remains non-deterministic during switching because:

- `setActiveTenant()` writes React state and storage immediately: [src/context/TenantContext.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.jsx:166)
- runtime singleton is only updated later by effect: [src/context/TenantContext.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.jsx:61)

The report explicitly admits this. That admission is correct. The “improved” claim is not.

### Verdict

No architectural ownership fix happened. This is still mitigation accumulation.

---

## 6. ProtectedRoute Safety Evaluation

This is the most serious false-positive in the phase report.

The implementation tries to clear `everAuthenticated.current` on real auth loss:

- clear branch: [src/components/auth/ProtectedRoute.jsx](/E:/PROJETOS/PettoFlow/src/components/auth/ProtectedRoute.jsx:23)

That looks correct until you follow React’s actual execution order.

### Why it is still broken

On auth loss:

1. context changes trigger render
2. during that render, `everAuthenticated.current` still contains the old `true`
3. the component returns `children` immediately: [src/components/auth/ProtectedRoute.jsx](/E:/PROJETOS/PettoFlow/src/components/auth/ProtectedRoute.jsx:37)
4. only after commit does the effect run and mutate the ref to `false`
5. mutating a ref does **not** trigger rerender

So the shell can remain mounted after real auth loss until some unrelated render happens later.

That means the phase report’s claim that this hazard was fixed is wrong.

### Test coverage is inadequate

The unit test file never exercises authenticated-to-unauthenticated transition. It only checks three static states:

- loading
- unauthenticated initial render
- authenticated initial render

Evidence: [src/components/auth/ProtectedRoute.test.jsx](/E:/PROJETOS/PettoFlow/src/components/auth/ProtectedRoute.test.jsx:11)

### Verdict

`ProtectedRoute` is still unsafe. The old hazard changed shape, but it did not disappear.

---

## 7. Onboarding Concurrency Assessment

The Phase 26 queue does **not** actually solve the stale-overwrite problem it claims to solve.

### What changed

`patchState()` is now chained through `mutationQueue.current`:

- queue setup: [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js:37)
- queued dispatch: [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js:89)

### Why the bug still exists

The mutators still build their payload **before** enqueueing:

- `completeChecklistItem()` snapshots `stateRef.current` and builds `nextChecklistState` immediately: [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js:119)
- only after that does it call `patchState(payload)`: [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js:137)

So two rapid calls still do this:

1. call A builds payload from state `S0`
2. call B builds payload from the same stale state `S0`
3. queue ensures A sends before B
4. B still sends the stale payload it already built

That is not a concurrency fix. It is delayed stale overwrite.

The report’s own explanation assumes payload recomputation at execution time. The code does not do that.

### Server semantics still make it worse

The backend still writes full onboarding blobs, not field-level patches. The audit from Phase 25 already established that. Phase 26 did not change the backend model.

### Tests do not catch this

The regression test remains sequential:

- it explicitly awaits mutation A before mutation B: [src/hooks/useOnboarding.test.jsx](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.test.jsx:96)

So the current green test suite does not validate the claimed fix.

### Verdict

This fix is **architecturally false**. The queue does not solve overlapping stale payload generation.

---

## 8. Shared Hook Stability Assessment

### Real improvements

- `useTransactions` is better: [src/hooks/useTransactions.js](/E:/PROJETOS/PettoFlow/src/hooks/useTransactions.js:15)
- `useReceivables` is better: [src/hooks/useReceivables.js](/E:/PROJETOS/PettoFlow/src/hooks/useReceivables.js:13)

### Overstated root cause

The report claims `getVisualFixture()` returns a new array every call. That is not generally true.

- it returns `window.__NEXUS_VISUAL_FIXTURES__?.[key] ?? fallback`: [src/visual/fixtureRuntime.js](/E:/PROJETOS/PettoFlow/src/visual/fixtureRuntime.js:5)

If the key exists in `VISUAL_FIXTURES`, the same reference is returned. The instability only happens when a hook falls back to a fresh literal like `[]` or `{}`.

### Remaining instability

Several visual-mode hooks still use unmemoized fixture lookups:

- [src/hooks/useAccounts.js](/E:/PROJETOS/PettoFlow/src/hooks/useAccounts.js:8)
- [src/hooks/useActivityTemplates.js](/E:/PROJETOS/PettoFlow/src/hooks/useActivityTemplates.js:11)
- [src/hooks/useFinCategories.js](/E:/PROJETOS/PettoFlow/src/hooks/useFinCategories.js:11)
- [src/hooks/useFinRules.js](/E:/PROJETOS/PettoFlow/src/hooks/useFinRules.js:11)
- [src/hooks/usePayees.js](/E:/PROJETOS/PettoFlow/src/hooks/usePayees.js:7)

And those hooks are used inside surfaces exercised by the harness:

- `FinanceView`: [src/components/Finance/FinanceView.jsx](/E:/PROJETOS/PettoFlow/src/components/Finance/FinanceView.jsx:56)
- `ActivitiesView`: [src/components/Activities/ActivitiesView.jsx](/E:/PROJETOS/PettoFlow/src/components/Activities/ActivitiesView.jsx:40)
- `CalendarView`: [src/components/Calendar/CalendarView.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarView.jsx:44)
- `ClientProfileModal`: [src/components/Clients/ClientProfileModal.jsx](/E:/PROJETOS/PettoFlow/src/components/Clients/ClientProfileModal.jsx:24)

Right now the harness fixture file contains those keys, so the immediate crash/loop risk is masked. The instability is still present as a pattern.

### Verdict

Shared hook stability improved narrowly. The report overstates closure.

---

## 9. RootErrorBoundary Assessment

### Real improvement

The boundary now remounts children on retry using a keyed `Fragment`: [src/components/shared/RootErrorBoundary.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/RootErrorBoundary.jsx:81)

That is better than the old blind state reset.

### Remaining defects

#### Retry budget is global, not per incident

`retryCount` is never reset after a successful recovery:

- state init: [src/components/shared/RootErrorBoundary.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/RootErrorBoundary.jsx:9)
- increment path: [src/components/shared/RootErrorBoundary.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/RootErrorBoundary.jsx:30)

After three recoveries anywhere in the app lifetime, future unrelated crashes start closer to exhaustion.

#### No async/event protection

This is still a normal React boundary. It does not catch:

- event handler exceptions
- async rejections
- post-render effect failures

#### No validation of recovery path

There is still no intentional crash test proving:

- fallback appears
- retry remount works
- exhausted state behaves correctly

### Verdict

Better than Phase 25. Still not robust enough to call “solved”.

---

## 10. Playwright Reliability Assessment

### What is good

- `npm.cmd run test:visual` passed twice
- no skipped or fixme tests were found in `playwright/` or `src/`
- the earlier harness crash is gone

### What is misleading in the report

The report conflates total suite count with runtime-hardening scope.

Actual checked-in counts:

- `playwright/runtime-hardening.spec.js` defines `16` specs per project, not `25`
- `playwright/visual-regression.spec.js` defines `9` specs per project
- total suite = `(16 + 9) * 3 = 75`

So `75 passed` is real. The report’s “25 specs × 3” explanation is not.

Evidence:

- runtime-hardening definitions: [playwright/runtime-hardening.spec.js](/E:/PROJETOS/PettoFlow/playwright/runtime-hardening.spec.js:33)
- visual baselines: [playwright/visual-regression.spec.js](/E:/PROJETOS/PettoFlow/playwright/visual-regression.spec.js:15)

### More important limitation

Playwright is running against a Vite dev server, not a production preview:

- `webServer.command`: [playwright.config.js](/E:/PROJETOS/PettoFlow/playwright.config.js:16)

That means the suite does **not** validate:

- production asset serving
- real built chunks
- cache invalidation behavior
- deployed lazy import behavior

### Verdict

The suite is green and repeatable locally. It is still a synthetic runtime harness, not production-runtime proof.

---

## 11. React 18 Safety Evaluation

React 18 safety remains mixed.

### Improved

- visual provider crash removed
- some effect dependency contracts are cleaner
- root boundary remount path is cleaner

### Still unsafe

- auth-loss reconciliation in `ProtectedRoute` is still wrong because it relies on a ref-mutating effect after render
- tenant identity still crosses context, module state, and storage
- onboarding still computes stale payloads before queued execution
- the harness still bypasses the real lazy/Suspense app path

This is not a React 18-hardened ownership model. It is a partially stabilized one.

---

## 12. Runtime Performance Integrity Validation

### Validation results

- `npm.cmd run build` passed
- lazy chunking still exists in build output
- no obvious startup explosion was introduced

### Remaining performance concerns

- Playwright does not validate production chunk loading because it uses dev server mode
- the harness eager-imports surfaces, so its green status says very little about runtime lazy chunk orchestration
- duplicate data ownership patterns remain in app surfaces, especially where multiple hooks are instantiated with overlapping data needs

### Verdict

Phase 26 did not obviously break performance integrity. It also did not truly validate it.

---

## 13. Architectural Sustainability Assessment

This codebase is stabilizing at the edges while keeping the same ownership ambiguities in the core.

### Cleaner

- the fixture harness no longer dies on basic provider assumptions
- a couple of obvious hook dependency problems were corrected

### Still dirty

- tenant ownership is still implicit
- auth-loss protection is still hacked through refs
- onboarding safety is still pretending queued stale payloads are safe
- test infrastructure still sidesteps the real runtime stack

That is not architectural closure. It is stabilization debt.

---

## 14. Production-Readiness Evaluation

### Operationally trustworthy?

Not fully.

### Runtime-safe?

Safer than Phase 25, but still not trustworthy on auth-loss and overlapping onboarding writes.

### Regression-protected?

Partially. The green suite proves the repaired fixture harness, not the real app runtime.

### Stable enough for feature expansion?

Still premature for anything that depends on:

- auth transitions
- tenant switching
- onboarding mutation integrity
- production lazy/chunk behavior

---

## 15. Remaining Technical Debt

- implicit tenant ownership via singleton + storage + context
- `ProtectedRoute` ref-based auth persistence logic
- onboarding blob-write semantics
- missing transition tests for auth loss and tenant switching
- missing intentional crash coverage for root boundary
- synthetic harness bypassing `App` / `RootRouter` / `TenantProvider` / lazy imports
- remaining visual hooks with unmemoized fixture lookups

---

## 16. Risk Severity Classification

### Critical

- `ProtectedRoute` fix is logically unsound and can still leave protected UI mounted after auth loss
- onboarding concurrency claim is false; stale payload overwrite risk still exists

### High

- tenant ownership remains fragmented and timing-sensitive
- Playwright still does not exercise the real runtime tree or production lazy-loading path

### Medium

- `RootErrorBoundary` retry budget is global and untested under intentional crash scenarios
- several visual-mode hooks still rely on fragile fixture lookup patterns

### Low

- the report’s runtime-hardening spec count is inflated and inaccurate

---

## 17. Recommended Next Stabilization Phase

### Suggested Phase 27

**Real ownership cleanup and transition-correctness validation.**

Required priorities:

1. Replace `ProtectedRoute` ref logic with render-state-driven auth reconciliation that rerenders deterministically on auth loss.
2. Fix onboarding mutators so queued work recomputes from latest committed state at execution time, or move conflict handling server-side.
3. Start explicit `tenantId` threading into workspace calls instead of global lookup.
4. Add transition tests for:
   - authenticated → unauthenticated
   - tenant switch while bootstrap fetch is in flight
   - overlapping onboarding mutations
5. Add at least one Playwright path that exercises the real app tree, not just `VisualRegressionApp`.
6. Add an intentional crash/recovery test for `RootErrorBoundary`.

---

## 18. Feature Expansion Decision

Feature expansion is **still premature**.

The harness is healthier. The underlying runtime ownership model is not.

Safe expansion areas are limited to isolated UI work that does not depend on:

- auth-loss behavior
- tenant switching correctness
- onboarding write integrity

Anything operationally critical should wait.

---

## 19. Rollback Decision

Rollback is still **not** justified.

Phase 26 contains real improvements:

- harness provider injection
- better hook memoization in two hotspots
- better root-boundary retry behavior

But those gains do not justify claiming the runtime ownership problem is solved.

---

## 20. Validation Evidence

Commands rerun in the current workspace:

- `npm.cmd run lint` → passed
- `npm.cmd test` → passed, `47 files`, `164 tests`
- `npm.cmd run build` → passed, `2117 modules transformed`
- `npm.cmd run test:visual` → passed twice, `75 passed`

Important caveat:

- `75 passed` is the combined Playwright suite, not `25 runtime-hardening specs × 3`
- the suite runs against `npm.cmd run dev`, not production preview

---

## Final Verdict

Phase 26 fixed the broken visual harness symptom and made the test suite green. It did **not** deliver the deeper runtime ownership closure the report claims.

The honest assessment is:

- harness repair: real
- tenant ownership cleanup: not done
- ProtectedRoute safety: still broken
- onboarding concurrency hardening: still broken
- Playwright reliability: useful, repeatable, and still synthetic

This frontend is more stable than it was. It is still not clean enough to trust aggressively.
