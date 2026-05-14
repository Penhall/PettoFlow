# PHASE 25 — Independent Hardening Audit

> Date: 2026-05-14
> Auditor stance: skeptical production review, no trust granted to the phase report
> Scope: runtime hardening, regression coverage, React 18 safety, operational stability

---

## 1. Executive Assessment

Phase 25 is **not validated as claimed**.

Some hardening work is real:

- `RootErrorBoundary` exists and is wired at the app root.
- `App.jsx` now blocks workspace bootstrap until `activeTenantId` exists.
- `closePalette()` was correctly moved outside `startTransition()`.
- unit tests and production build pass in the current workspace.

But the phase report materially overstates safety:

- the new Playwright runtime-hardening suite is **red**, not complete
- the visual harness used by those tests is structurally broken and crashes into `RootErrorBoundary`
- tenant resolution is still built on global mutable state plus `localStorage` fallback
- onboarding mutation hardening is still **last-write-wins mitigation**, not concurrency-safe architecture
- critical claims of “full validation” and “E2E coverage completed” are false in the current codebase

This frontend is **not ready for feature expansion under the assumption that runtime stability is solved**. The current state is better than pre-hardening, but still dependent on tactical patches and still carrying unresolved architectural fragility.

---

## 2. Verification of Claimed Phase 25 Fixes

| Claimed fix | Verdict | Assessment |
|---|---|---|
| RootErrorBoundary | Partial | Implemented, but only as a coarse shell-level fallback. It does not provide meaningful crash isolation for async/event-driven failures. |
| Tenant-resolution guard | Partial | Real improvement in `App.jsx`, but still layered on top of implicit tenant lookup through global runtime state and `localStorage`. |
| Onboarding mutation hardening | Mitigation only | `stateRef` reduces stale closure reads inside one React tree, but does not solve concurrent writes, out-of-order responses, or multi-tab overwrite risk. |
| Regression tests | Partial / shallow | Some helper-level coverage exists, but the tests do not prove the original runtime bugs are closed at system level. |
| Playwright E2E coverage | Failed | The runtime-hardening suite currently fails because the harness itself crashes into the root error boundary. |
| Command palette transition fix | Robust local fix | The code change is correct, but coverage is weak and does not prove end-to-end overlay synchronization. |
| Billing test stabilization | Robust narrow fix | Missing export issue was fixed, but it is unrelated to the core runtime hardening story. |
| “Lint + Test + Build complete validation” | False | `lint` and `build` pass, `vitest` passes, but `npm run test:visual` fails heavily. |

---

## 3. Robust Fixes vs Mitigations

### Robust fixes

- `RootErrorBoundary` is actually mounted at the root in `src/main.jsx:22-34`.
- `handleTabChange` now closes the command palette synchronously before transition work in `src/App.jsx:290-304`.
- workspace bootstrap in `src/App.jsx:165-196` now refuses to fetch until `activeTenantId` is available.
- `fetchAdminBilling` export issue was fixed and billing tests are no longer blocked by that missing symbol.

### Mitigations disguised as fixes

- `activeTenant` safety still depends on `currentActiveTenantId` plus `localStorage` fallback in `src/lib/activeTenant.js:35-45`.
- onboarding state safety still depends on `stateRef.current` in `src/hooks/useOnboarding.js:32-40`, `106-177`.
- backend onboarding writes still upsert merged blobs with no version check in `supabase/functions/tenant-core/index.ts:365-386`.
- shell-level runtime coverage still relies on a visual harness that bypasses real auth and tenant flow, while that harness is currently miswired.

These are not architecture-level corrections. They are patches placed around unstable ownership boundaries.

---

## 4. Remaining Runtime Risks

### Critical

- The Playwright runtime-hardening suite is failing because the visual harness crashes into the root boundary on the happy path.
- Visual regression passing cannot currently be trusted as runtime evidence, because the harness can render fallback UI instead of healthy app UI.

### High

- Tenant resolution still uses hidden global state and storage fallback instead of explicit tenant ownership at the data boundary.
- Onboarding writes remain vulnerable to lost updates across concurrent requests, out-of-order responses, and multi-tab sessions.
- `ProtectedRoute` can continue rendering protected content after auth loss because `everAuthenticated.current` short-circuits the route permanently (`src/components/auth/ProtectedRoute.jsx:29-33`).

### Medium

- Root-level recovery is weak. `handleReset()` in `src/components/shared/RootErrorBoundary.jsx:20-22` only clears boundary state. It does not remount the failing subtree or repair the underlying bad state.
- Shared data hooks still have unstable dependency patterns that can amplify renders and refetches.

---

## 5. RootErrorBoundary Evaluation

### What is implemented

`RootErrorBoundary` is a real class boundary in `src/components/shared/RootErrorBoundary.jsx:5-64`, mounted in `src/main.jsx:22-34`.

It catches:

- render-time exceptions
- lifecycle errors
- constructor failures in the React subtree below it

### What it does not solve

It does **not** catch:

- event handler exceptions
- async promise rejections
- failed effects after render
- network failures unless they are rethrown into render

That is standard React behavior, but the phase report presents it as broader shell protection than it actually is.

### Recovery quality

Recovery is weak:

- `Tentar novamente` only clears boundary state (`src/components/shared/RootErrorBoundary.jsx:20-22`)
- if the underlying subtree still throws on next render, the app goes straight back to fallback
- there is no deterministic subtree reset key, no navigation reset, and no runtime state sanitation

### Lazy import failure handling

`lazyWithRetry` exists in `src/lib/lazyWithRetry.js:7-43`. It does a one-time reload for chunk-load-style errors using `sessionStorage`.

That is acceptable as a narrow chunk-staleness strategy, but:

- it does not isolate failures to a modal or surface
- it escalates by reloading the full page
- when the second attempt still fails, the error bubbles to the nearest boundary

Surface-level chunk failures are partially contained by `ViewErrorBoundary` (`src/components/shared/ViewErrorBoundary.jsx:29-72`), but anything outside those scoped boundaries can still take the full shell down to the root fallback.

### Actual runtime evidence

The strongest evidence against the report is the failing happy-path Playwright run:

- `test-results/runtime-hardening-surface--587a0-t-root-error-boundary-tasks-desktop/error-context.md:15-27`
- `test-results/runtime-hardening-command--b5fff-loses-via-keyboard-shortcut-desktop/error-context.md:15-27`

Both show `.root-error-boundary` visible when the test explicitly expects it to stay hidden.

### Verdict

`RootErrorBoundary` is a useful last-resort fallback. It is **not** proof of shell resilience, and it is **not** sufficient crash isolation.

---

## 6. Tenant-Resolution Architecture Evaluation

### What improved

`App.jsx` now gates workspace bootstrap on `activeTenantId`:

- guard in `src/App.jsx:171-174`
- fetch path in `src/App.jsx:179-193`
- effect keyed to `[activeTenantId]` in `src/App.jsx:196`

That is a legitimate fix for the specific unconditional-bootstrap defect from the previous phase.

### Why this is still not architecturally safe

The deeper architecture remains muddled:

- `workspaceCoreRequest()` still implicitly resolves tenant using `getRequiredActiveTenantId()` in `src/lib/workspaceCore.js:32-40`
- `getRequiredActiveTenantId()` still reads a module-global singleton and then `localStorage` in `src/lib/activeTenant.js:35-45`
- `TenantContext` updates React state, runtime singleton, and `localStorage` on different timings in `src/context/TenantContext.jsx:61-63`, `96-101`, `166-181`

This means tenant identity is still owned by multiple mechanisms:

- React context state
- module global mutable state
- browser storage

That is not a clean ownership model. It is a coordination problem disguised as a convenience layer.

### Remaining race windows

1. Tenant switching can still create mismatch windows.
   `setActiveTenant()` writes React state and `localStorage` together in `src/context/TenantContext.jsx:166-181`, but `currentActiveTenantId` is only updated later by effect in `61-63`. During that window, React UI may still reflect the old tree while storage/global lookups can resolve differently.

2. Bootstrap reads still depend on implicit tenant resolution.
   `fetchTeam()` and `fetchClients()` in `src/App.jsx:147-163` call `fetchWorkspaceBootstrap()` without explicit tenant threading.

3. Silent tenant-null behavior still exists.
   The bootstrap guard sets `loading` false and returns if no tenant exists (`src/App.jsx:171-174`). That avoids a bad fetch, but it does not distinguish “tenant still hydrating” from “no active workspace” at the data-boundary level.

### Verdict

This is a **real mitigation** and a **partial bug fix**. It is not a proper tenant-resolution architecture. The system still depends on side-channel tenant lookup.

---

## 7. Regression Test Quality Assessment

The new test layer is mixed. Some tests are useful. The important ones are too shallow.

### `activeTenant.test.js`

What it proves:

- helper precedence rules
- `TENANT_REQUIRED` error shape
- `localStorage` fallback behavior

What it does **not** prove:

- parent/child effect ordering under real React tree mount
- bootstrap correctness in `App.jsx`
- tenant switching behavior
- interaction between `TenantContext`, `RootRouter`, and workspace fetches

This is helper testing, not runtime validation.

Evidence:

- helper-only coverage in `src/lib/activeTenant.test.js:18-67`

### `useOnboarding.test.jsx`

The report claims stale mutation protection. The test file does not prove that.

The most important test is explicitly sequential:

- the test description says “rapid consecutive”
- the implementation awaits mutation A before mutation B in `src/hooks/useOnboarding.test.jsx:96-103`

That does not exercise overlapping requests, out-of-order completion, or concurrent mutation conflict. It verifies only that `stateRef` helps after the first call has already committed.

The remaining tests check duplicate suppression and failure fallback, but still at local-hook level with mocked API boundaries.

### `useCommandPalette.test.js`

Useful for keyboard detection and query behavior.

Not sufficient for Phase 25 claims:

- no integration with `App.jsx`
- no test for `closePalette()` before `startTransition()`
- no overlay lifecycle sequencing
- no route transition synchronization

### Missing tests in critical areas

There is still no meaningful integration test for:

- root error boundary behavior
- tenant bootstrap gating through the real app tree
- command palette transition behavior inside the app shell
- onboarding auto-prompt effect in `App.jsx:267-288`
- auth-loss interaction with `ProtectedRoute`

### Verdict

The regression suite is **not fake**, but it is **not sufficient** to justify the report’s confidence. It is too mocked and too local to prove runtime safety.

---

## 8. Playwright Coverage Assessment

### Current status

`npm.cmd run test:visual` is failing in the current repository state.

Observed result:

- 42 failed
- 18 passed

This alone invalidates the phase claim that E2E coverage was completed and validated.

### Why the runtime-hardening suite fails

The runtime-hardening tests rely on `?visual-regression=1`:

- `playwright/runtime-hardening.spec.js:4-11`
- `src/main.jsx:13-33`

In that mode, `main.jsx` mounts `VisualRegressionApp` **without** `AuthProvider` or `TenantProvider`:

- visual entry path in `src/main.jsx:23-26`
- normal app path with providers in `src/main.jsx:27-33`

But `VisualRegressionApp` renders shell components that require those providers:

- `SidebarRail` in `src/visual/VisualRegressionApp.jsx:43-52`
- `Topbar` in `src/visual/VisualRegressionApp.jsx:53-62`
- `SidebarRail` calls `useAuth()` and `useTenant()` in `src/components/shell/SidebarRail.jsx:17-18`, `47-48`
- `Topbar` renders `TenantSwitcher` in `src/components/shell/Topbar.jsx:29`
- `TenantSwitcher` calls `useTenant()` in `src/components/tenant/TenantSwitcher.jsx:1-5`

That is the defect. The harness shell is asking for providers that are not mounted in visual mode, and the resulting error is being caught by `RootErrorBoundary`.

### Coverage quality even if the harness were fixed

Even with the provider issue fixed, the suite is still narrow:

- it uses fixture mode, not real auth or tenant hydration
- it validates shell visibility and non-crash, not concurrency behavior
- it does not stress rapid tab switching, repeated overlay open/close, or async race timing

### Additional report inaccuracies

The phase report says `playwright/runtime-hardening.spec.js` contains 10 E2E specs. The file actually defines 11 tests per Playwright project:

- 7 surface tests
- 1 shell integrity test
- 1 command palette test
- 1 record sidebar test
- 1 client profile modal test

Evidence:

- test definitions in `playwright/runtime-hardening.spec.js:20-93`

### Verdict

Current Playwright coverage is **not reliable evidence of runtime hardening**. Right now it is failing against a broken harness.

---

## 9. Onboarding Mutation Hardening Evaluation

### What was actually implemented

`useOnboarding` maintains `stateRef` and reads from it inside mutators:

- ref setup in `src/hooks/useOnboarding.js:31-40`
- mutator reads in `106-177`

This helps with stale closure reads inside a single mounted hook instance.

### What it does not solve

It does not solve true write concurrency.

`patchState()` still sends partial subtree payloads:

- `patchState` in `src/hooks/useOnboarding.js:80-93`

The backend then reconstructs payload from current row state and request body, then `upsert`s:

- merge payload in `supabase/functions/tenant-core/index.ts:365-373`
- write in `379-386`

There is:

- no revision number
- no compare-and-swap
- no optimistic locking
- no server-side conflict detection

So the system is still vulnerable to:

- overlapping requests from the same tab
- out-of-order response commit
- multi-tab state clobbering
- stale server-read + overwrite on concurrent update

### Verdict

This is a mitigation against one symptom class. It is **not a concurrency-safe onboarding state model**.

---

## 10. Command Palette Runtime Behavior

### What is correct

The local fix is correct:

- `closePalette()` runs before `startTransition()` in `src/App.jsx:290-304`

That is the right React 18 behavior for urgent overlay teardown.

### What remains weak

- there is no integration test proving the palette closes deterministically during real tab navigation
- the hook tests only cover keyboard events and filtering
- the Playwright test that was supposed to validate no-crash behavior is currently blocked by the broken harness and never proves actual overlay sequencing

### Verdict

This is one of the better code changes in Phase 25, but the validation story around it is thin.

---

## 11. React 18 Concurrency Safety Assessment

This codebase is safer than before, but still not clean under concurrent rendering pressure.

### Positive changes

- bootstrap effect is idempotent enough for repeated mount/unmount around `activeTenantId`
- command palette close is now correctly prioritized
- most lazy surfaces sit behind scoped boundaries

### Remaining hazards

#### Auth lifetime hazard

`ProtectedRoute` permanently trusts any prior authenticated state:

- `everAuthenticated.current` short-circuit in `src/components/auth/ProtectedRoute.jsx:15`, `23-33`

That suppresses flicker, but it also suppresses legitimate auth-loss transitions. If auth becomes invalid, the protected shell can continue rendering until deeper failures surface elsewhere.

#### State ownership fragmentation

Tenant, onboarding, auth, and visual harness modes all mix context state with hidden external channels. That increases the chance of inconsistent reads under remounts and deferred updates.

#### Data hook dependency instability

`useTransactions` still depends on unstable references:

- `fixtureTransactions` is recreated from `getVisualFixture()` in `src/hooks/useTransactions.js:13`
- effect depends on both `filters` and `filtersKey` and `fixtureTransactions` in `26-50`

That is a sloppy dependency contract and can refetch or rerender more often than intended.

`useReceivables` uses a callback keyed on `fixtureReceivables`:

- `fixtureReceivables` acquisition in `src/hooks/useReceivables.js:11`
- callback deps in `15-33`

That is another unstable reference path.

### Verdict

React 18 safety is improved but not hardened. Concurrency-sensitive ownership problems remain.

---

## 12. Runtime Performance Integrity Evaluation

### What did not regress

- `npm.cmd run build` passes
- lazy chunking is still present
- `lazyWithRetry` does not force eager imports
- the root boundary itself adds negligible overhead

### What still threatens performance integrity

- broken visual harness invalidates E2E confidence around real lazy surface behavior
- unstable hook dependencies can still cause extra effect executions
- duplicated data ownership patterns still risk repeated bootstrap-style fetching across surfaces

### Verdict

Phase 25 did **not** obviously break chunking or startup shape. It also did **not** eliminate the broader rerender/refetch integrity risks already present in the architecture.

---

## 13. Architectural Sustainability Assessment

This phase improved survivability. It did not fundamentally clean up the runtime architecture.

### What got better

- there is now a shell-level fallback instead of unconditional white-screen death
- one important transition bug was corrected properly
- tenant bootstrap is less timing-sensitive than before

### What remains structurally weak

- tenant identity is still a cross-cutting hidden dependency
- onboarding state is still blob-patch based, not conflict-aware
- test harnesses do not faithfully reflect real provider topology
- route protection still contains a persistence hack that can mask auth state changes

This is the pattern of a codebase being stabilized with compensating layers instead of being simplified at the ownership boundaries.

### Verdict

Phase 25 strengthened the facade. It did not fully stabilize the foundation.

---

## 14. Production-Readiness Evaluation

### Production-safe?

No.

### Operationally stable?

Not to the standard claimed by the report.

### Regression-protected?

Partially, and with false confidence in the most visible layer because the Playwright harness is currently broken.

### Safe for future expansion?

No. Feature expansion now would stack new behavior onto still-fragile runtime ownership paths.

---

## 15. Remaining Technical Debt

- implicit tenant resolution inside `workspaceCore`
- module-global tenant state plus `localStorage` fallback
- onboarding blob writes with no conflict control
- `ProtectedRoute` auth persistence shortcut
- broken provider topology in visual regression mode
- shallow regression coverage for runtime sequencing defects
- unstable dependencies in shared data hooks

---

## 16. Risk Severity Classification

### Critical

- broken runtime-hardening Playwright harness
- false “E2E completed” claim in the phase report

### High

- onboarding last-write-wins concurrency model
- implicit tenant resolution through hidden shared state
- auth-loss masking in `ProtectedRoute`

### Medium

- root boundary reset is not deterministic recovery
- unstable hook dependencies in shared data hooks
- test coverage misses real React tree timing paths

### Low

- billing test export defect was fixed and is not a remaining production blocker

---

## 17. Recommended Next Stabilization Phase

### Suggested Phase 26

**Provider topology repair, explicit tenant threading, and conflict-safe onboarding state.**

Required priorities:

1. Fix the visual/runtime harness so it mounts the same provider graph the shell requires.
2. Replace implicit tenant lookup in `workspaceCore` with explicit tenant threading at the call boundary.
3. Remove the `everAuthenticated` bypass hack or constrain it with deterministic auth invalidation logic.
4. Redesign onboarding writes around versioned or conflict-aware updates.
5. Add integration tests for:
   - root boundary recovery
   - real tenant bootstrap timing
   - command palette close during tab transitions
   - auth loss and tenant switching
6. Audit shared data hooks for unstable dependency contracts and duplicate fetch ownership.

---

## 18. Rollback Recommendation

### Should the premium architecture be rolled back entirely?

Not automatically.

The redesign itself is not the thing that must be rolled back. The problem is that the runtime contract around it is still not solid enough.

### Is rollback of the Phase 25 hardening justified?

No. Some changes are beneficial and should stay:

- bootstrap guard
- command palette close sequencing
- root boundary presence

### Release decision

Do **not** treat Phase 25 as production sign-off. Release approval should be blocked until the broken harness, tenant ownership model, and onboarding concurrency model are addressed.

---

## 19. Feature Expansion Decision

Feature expansion is **premature**.

Adding more behavior now increases the blast radius of:

- tenant-state ambiguity
- onboarding overwrite hazards
- auth persistence hacks
- incomplete runtime regression coverage

The correct move is another stabilization phase focused on ownership clarity and runtime verification, not new product scope.

---

## 20. Verification Evidence

### Commands executed

- `npm.cmd run lint` → passed
- `npm.cmd test` → passed, `47/47 files`, `164/164 tests`
- `npm.cmd run build` → passed
- `npm.cmd run test:visual` → failed, `42 failed`, `18 passed`

### Report claim disproven directly

The Phase 25 report states “Todos os objetivos foram concluídos e validados com lint + tests + build limpos” in `docs/PHASE_25_RUNTIME_HARDENING_AND_REGRESSION_COVERAGE.md:6` and repeats full validation claims in `35`, `310-343`.

That claim is not true in the current repository state because the Playwright hardening suite is failing.

---

## Final Verdict

Phase 25 delivered a handful of useful hardening patches. It did **not** deliver the level of runtime safety, regression protection, or architectural closure that the report claims.

The honest assessment is:

- some fixes are real
- several are only mitigations
- one major validation layer is currently broken
- the runtime architecture is still carrying hidden state and concurrency debt

This phase should be treated as **partial hardening**, not completion.
