# PHASE 28 Independent Runtime Audit

## 1. Executive assessment

Phase 28 improved the shape of the workspace API surface, but the report overstates the result.

What is real:
- `workspaceCore.js` now exposes explicit `tenantId` parameters across the public request layer.
- `App.jsx` threads `activeTenantId` into its own bootstrap and task/account flows.
- The Playwright suite is genuinely green.
- Runtime diagnostics gained additional helper functions.

What is false or overstated:
- Explicit tenant ownership is not “closed.” The fallback singleton is still live and still heavily exercised.
- The new “real topology” harness is not the real production topology. It still bypasses `AuthProvider`, `RootRouter`, and `TenantProvider`.
- Async fault isolation did not materially harden. It mostly gained comments and logging.
- Observability is not meaningfully upgraded when three of the four new trace helpers are dead code.

Bottom line: Phase 28 is incremental hardening, not ownership completion.

## 2. Verification of each claimed Phase 28 fix

### Explicit tenant ownership

Verdict: **partial implementation**

Verified:
- `src/lib/workspaceCore.js` now accepts `tenantId` on all exported business functions.
- `src/App.jsx` passes `activeTenantId` into `fetchWorkspaceBootstrap`, task mutations, column mutations, and `listActiveAccounts`.
- `useActivities` and `useReceivables` now accept `{ tenantId }`.

Not verified:
- The report says “all 34 public functions” now accept `tenantId`. The actual file exports **39** public async functions plus `workspaceCoreRequest`.
- The report implies the ownership gap is closed. It is not. `workspaceCoreRequest` still resolves `tenantId ?? getRequiredActiveTenantId()`, so the singleton fallback remains first-class runtime behavior.
- Many hooks and component call-sites still do not pass tenant explicitly at all.

### Real runtime topology

Verdict: **partially more real, still synthetic**

Verified:
- `RuntimeHarnessApp.jsx` now mounts `ProtectedRoute`, `TenantGate`, and the real `App` component.
- `app-topology.spec.js` exists and passes.

Not verified:
- The harness does **not** mount the production chain from `src/main.jsx`.
- Production path: `AuthProvider -> ProtectedRoute -> RootRouter -> TenantProvider -> TenantGate -> App`
- Harness path: `AuthContext.Provider -> ProtectedRoute -> TenantContext.Provider -> TenantGate -> App`
- That means auth hydration, `onAuthStateChange`, `RootRouter`, admin/app route switching, and real tenant-provider loading are still bypassed.

### Bootstrap orchestration validation

Verdict: **partial**

Verified:
- `App.jsx` still guards bootstrap on `activeTenantId`.
- Bootstrap tracing was wired with `traceBootstrap('start' | 'ready' | 'error' | 'cancelled', activeTenantId)`.

Not verified:
- The new topology tests do not validate a real successful bootstrap path. They validate that bootstrap failure does not hang because the harness has no real authenticated Supabase session.
- Auth transitions in Playwright are simulated by full page navigation between fixture URLs, not by live auth-state changes inside a mounted tree.

### Async fault isolation

Verdict: **mostly logging, not containment**

Verified:
- `RootErrorBoundary` documents its async limitations.
- It now installs an `unhandledrejection` listener.
- `lazyWithRetry.js` logs before reload/rethrow.

Not verified:
- No new containment mechanism exists for async failures.
- No new recovery path exists for rejected promises, event-handler errors, or lazy failures beyond page reload or console output.
- `traceAsyncFailure` is dead code.

### Runtime observability

Verdict: **overclaimed**

Verified:
- `traceBootstrap` and `traceTenant` are used.

Not verified:
- `traceOwnership` is never called.
- `traceAsyncFailure` is never called.
- `traceRouteTransition` is never called.
- The report describes four useful new diagnostics; the codebase currently uses one new one materially and one existing tenant trace.

## 3. Robust fixes vs mitigations

### Robust enough

- `workspaceCore` now supports explicit `tenantId` across the public API surface.
- `App.jsx` bootstrap and direct task/account flows are less dependent on fallback global tenant lookup.
- The Playwright suite is genuinely passing, not silently broken.

### Still mitigations

- The singleton tenant fallback remains core runtime behavior.
- The harness is still fixture-driven.
- Async failure handling is still mostly console logging plus reload behavior.
- Diagnostics are still shallow and partially unused.

## 4. Explicit tenant ownership evaluation

This is the core failure of the Phase 28 narrative.

The API layer improved. The ownership model did not complete.

Evidence that ownership is still hybrid:
- `src/lib/workspaceCore.js` still routes all omitted tenant calls through `getRequiredActiveTenantId()`.
- `src/hooks/useAccounts.js` still calls `listAccountRecords()` and `saveAccountRecord()` with no tenant.
- `src/hooks/useTransactions.js` still calls `listTransactionRecords()`, `createTransactionRecord()`, `updateTransactionRecord()`, and `deleteTransactionRecord()` with no tenant.
- `src/hooks/useActivityTemplates.js`, `src/hooks/useFinCategories.js`, `src/hooks/useFinRules.js`, and `src/hooks/usePayees.js` still rely on implicit resolution.
- `src/components/Activities/ActivitiesView.jsx`, `src/components/Finance/FinanceView.jsx`, `src/components/Calendar/CalendarView.jsx`, and `src/components/Tasks/TaskModal.jsx` still call these hooks without tenant threading.
- `src/components/Clients/ClientProfileModal.jsx` still calls `listInteractionLogRecords(client.id)` and `createInteractionLogRecord(...)` without tenant threading.
- `src/components/Clients/ClientesView.jsx` and `src/components/Team/TimeView.jsx` still call client/team CRUD helpers without tenant threading.

This matters because:
- Ownership is still caller-implicit rather than request-explicit across large parts of the app.
- Timing luck still matters in the fallback path because the request source does not declare which tenant it intends to use.
- Future feature work can still silently bind to the wrong tenant-resolution mechanism and pass tests.

Conclusion: this is API parameterization plus selective call-site cleanup, not explicit ownership completion.

## 5. Runtime topology evaluation

The new harness is better than the old one. It is not the real app topology.

What it now exercises:
- `ProtectedRoute`
- `TenantGate`
- `App`

What it still skips:
- `AuthProvider`
- `RootRouter`
- `TenantProvider`
- real auth hydration timing
- real tenant list loading
- real admin/app route split

This is not a minor detail. It means the suite still does not validate the actual startup chain used in production.

The stress tests are also weaker than they look:
- `stress-paths.spec.js` mostly uses repeated `page.goto(...)` calls.
- That restarts the app repeatedly.
- It does **not** simulate the same mounted tree surviving rapid auth changes, tenant changes, or route changes under concurrent state pressure.

Conclusion: topology realism improved, but the report still markets a harness as the production root.

## 6. Bootstrap orchestration evaluation

Bootstrap is safer in `App.jsx` than it was in earlier phases, but Phase 28 does not fully validate it.

Good:
- `App.jsx` guards fetches until `activeTenantId` exists.
- Bootstrap cancellation still prevents stale `setState` after unmount.
- Explicit tenant threading in bootstrap reduces the most obvious child-before-parent race.

Weak:
- A large part of the app still uses implicit tenant lookup outside bootstrap.
- The topology tests do not prove successful startup behavior with real auth hydration and tenant hydration.
- The “bootstrap resolves” Playwright test only proves the loading screen disappears after a fast auth error in the harness.

Conclusion: bootstrap orchestration is better instrumented, not comprehensively validated.

## 7. Async fault isolation evaluation

Phase 28 did not really isolate async faults. It documented them and logged them.

Current reality:
- `RootErrorBoundary` still catches synchronous render/lifecycle failures only.
- `window.unhandledrejection` logging is not recovery.
- `lazyWithRetry` still handles chunk failure by reloading the entire page once, then rethrowing.
- There is no deeper containment for async startup failures, event-handler exceptions, or promise chains outside render.

Testing gap:
- No new tests verify `unhandledrejection` behavior.
- No new tests simulate lazy chunk failure or `ChunkLoadError`.
- No new tests prove deterministic recovery from async startup faults.

Conclusion: async fault isolation remains incomplete and mostly unchanged in capability.

## 8. Runtime observability assessment

Observability got more API surface than real runtime value.

What is useful:
- `traceBootstrap` in `TenantContext.jsx` and `App.jsx`
- `traceTenant` on active tenant changes

What is dead:
- `traceOwnership`
- `traceAsyncFailure`
- `traceRouteTransition`

That makes the report’s observability claim misleading. A gated diagnostic helper that nobody calls does not improve debugging.

Conclusion: lightweight, yes. Genuinely useful, only partially.

## 9. Stress-path validation assessment

The suite is stable. The stress model is still weaker than the report implies.

What the suite proves:
- Repeated harness reloads do not immediately trip `.root-error-boundary`.
- Visual fixture surfaces still render across desktop, tablet, and mobile.
- The new app-topology harness does not crash on its limited fixture paths.

What it does not prove:
- real auth transitions inside a mounted `AuthProvider`
- real tenant switching inside a mounted `TenantProvider`
- real `RootRouter` navigation behavior
- real production lazy-route orchestration
- real startup races in the production provider graph

Conclusion: deterministic suite, partial runtime truth.

## 10. React 18 safety evaluation

Phase 28 did not introduce obvious new React 18 breakage. It also did not finish the React 18 ownership problem.

Improved:
- More request paths can now be made explicit.
- Bootstrap uses explicit tenant threading where it matters most.

Still exposed:
- Many hooks still derive tenant from a global fallback instead of explicit props/context threading.
- The real provider graph is still not under browser automation.
- Async failure classes still bypass React error boundaries exactly as before.

Conclusion: safer than Phase 27 in selected paths, still not fully deterministic under ownership-sensitive concurrency.

## 11. Runtime performance integrity validation

Validation results:
- `npm.cmd run build` passed.
- The production build still code-splits correctly.
- `RuntimeHarnessApp` remains dev-only and does not appear in the production entry path.

Important caveat:
- `VisualRegressionApp` still ships as a production lazy chunk. It appears in `dist/assets/VisualRegressionApp-*.js`.
- That does not hit startup cost immediately because it is lazy, but test-only runtime code is still being deployed.

No evidence found of:
- eager-loading regressions
- rerender storms introduced by Phase 28
- broken chunking

Conclusion: performance integrity is mostly preserved, but test harness code still leaks into the production build as a lazy asset.

## 12. Architectural sustainability assessment

Phase 28 moves the architecture in the right direction at the API boundary and leaves the application layer behind.

Why that matters:
- The request layer can now accept explicit ownership.
- The UI and hook layer still often refuses to provide it.
- That creates a false sense of cleanup while the runtime still depends on implicit global state across large surfaces.

This is stabilization debt, not completion.

Conclusion: maintainability improved slightly. Ownership clarity is still not strong enough to call this sustainable cleanup.

## 13. Production-readiness evaluation

NexusCRM is more trustworthy than it was in Phase 27. It is not yet tenant-clean or topology-clean.

Accurate statement:
- safer for incremental feature work
- less fragile in core bootstrap/task flows
- regression-protected better than before

Inaccurate statement:
- “tenant-safe”
- “runtime-deterministic”
- “real topology validated”

Conclusion: closer to production-grade orchestration, still not there.

## 14. Remaining technical debt

- Singleton tenant fallback remains embedded in `activeTenant.js` and still widely used.
- Large hook families still do not thread tenant explicitly.
- Real provider topology is still not the Playwright topology.
- Async observability helpers are mostly unused.
- Test-only `VisualRegressionApp` still ships in production as a lazy chunk.
- `workspaceCore` explicit threading is covered by only three focused unit tests around `createTaskRecord`, not the broader 39-function surface.

## 15. Risk severity classification

### High

- Tenant ownership is still hybrid across major runtime surfaces. This remains the central architectural risk.
- The “real topology” suite still does not exercise the production root chain, which preserves blind spots around auth hydration and tenant-provider orchestration.

### Medium

- Async fault isolation remains mostly logging/reload behavior.
- Observability is partially dead and therefore weaker than the report claims.
- Production still ships the visual harness chunk.

### Low

- Report accuracy is sloppy: the function count claim is wrong, and the coverage story is broader than the actual implementation supports.

## 16. Whether feature expansion is now safer

Feature expansion is safer than it was in Phase 27.

It is still premature for:
- tenant-sensitive data features
- auth/tenant transition-heavy orchestration
- new shared hooks that continue the implicit ownership pattern

Low-risk UI and isolated product work are reasonable.

Anything that increases cross-surface tenant coupling should wait until the app layer actually uses the explicit tenant API consistently.

## 17. Whether rollback remains unjustified

Rollback remains unjustified.

Phase 28 did not make the system worse. It improved the API boundary, kept build and suite integrity, and reduced some bootstrap ambiguity. The correct response is not rollback. The correct response is to stop calling this “ownership complete” and run a narrower follow-up focused on:
- explicit tenant threading across remaining hooks and CRUD call-sites
- real Playwright coverage for the true `main.jsx` provider graph
- meaningful async failure classification and recovery at call-sites
- removing production-shipped visual harness code or isolating it from deploys

## Validation evidence

- `npm.cmd run lint`: passed
- `npm.cmd test`: passed, `47 files`, `175 tests`
- `npm.cmd run build`: passed, `2119 modules transformed`, built in `8.49s`
- `npm.cmd run test:visual`: passed, `162 passed` in `49.7s`
