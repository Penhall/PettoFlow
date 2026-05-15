# PHASE 27 Independent Runtime Audit

## 1. Executive assessment

Phase 27 is the first stabilization phase that materially fixes two previously confirmed runtime defects instead of papering over them. The `ProtectedRoute` auth-loss bug is actually corrected, and the onboarding queue now recomputes payloads from committed state instead of shipping stale snapshots.

That does not mean the report is clean or complete. Tenant ownership is still mostly implicit. The new Playwright runtime path is less fake than before, but it is still a fixture harness, not the real application bootstrap. `RootErrorBoundary` coverage improved, but only for synchronous render crashes and deterministic retry exhaustion. The architecture is safer than Phase 26, but it is still mitigation-heavy in the ownership layer.

Bottom line: Phase 27 improves runtime determinism in real ways. It does not complete runtime ownership cleanup.

## 2. Verification of each claimed Phase 27 fix

### ProtectedRoute auth invalidation

Verdict: **robust fix**

Evidence:
- `src/components/auth/ProtectedRoute.jsx` replaced the old ref-based persistence gate with `authInitialized` state.
- The route now rerenders when `isAuthenticated` changes, so auth loss is no longer hidden behind a mutated ref that never triggered reconciliation.
- `src/components/auth/ProtectedRoute.test.jsx` now covers hydration, unauthenticated render, auth gain, auth loss, and logout transition behavior.

Assessment:
- This fixes the exact failure mode found in the previous audit.
- The remaining anti-flicker behavior is a policy decision, not the old correctness bug.

### Onboarding payload recomputation

Verdict: **real fix with known backend limits**

Evidence:
- `src/hooks/useOnboarding.js` changed `patchState` to accept a state builder and to compute the outbound payload inside the queued mutation path.
- `committedStateRef.current` is updated before the async patch resolves, so the next queued mutation composes on the newest committed local state instead of an obsolete closure snapshot.
- `src/hooks/useOnboarding.test.jsx` adds explicit concurrent mutation coverage for checklist, dismiss, tutorial, and failure recovery paths.

Assessment:
- This resolves the specific stale-payload overwrite bug identified in Phase 26.
- It does not solve multi-tab or multi-actor last-write-wins limits because the persistence model is still patching shared blobs without versioned conflict resolution.

### Tenant ownership cleanup

Verdict: **incremental improvement, not a cleanup**

Evidence:
- `src/lib/workspaceCore.js` now allows `fetchWorkspaceBootstrap({ tenantId })`.
- `src/App.jsx` explicitly threads `activeTenantId` into bootstrap, team fetch, and client fetch paths.
- The rest of `workspaceCore` still defaults to `getRequiredActiveTenantId()` when no tenant is passed.

Assessment:
- This is not “real ownership cleanup.” It is the start of explicit tenant threading at the bootstrap boundary.
- Global tenant lookup is still dominant across the broader data layer.

### Real runtime Playwright validation

Verdict: **improved, still synthetic**

Evidence:
- `src/main.jsx` now mounts `RuntimeHarnessApp` behind the dev-only `?runtime-harness=1` gate.
- `src/visual/RuntimeHarnessApp.jsx` mounts `AuthContext.Provider`, `TenantContext.Provider`, `ProtectedRoute`, and a crash test surface.
- `playwright/runtime-topology.spec.js` validates authenticated, unauthenticated, and auth-transition paths through that harness.

Assessment:
- This is better than the old provider-free visual harness.
- It still does not mount the real `AuthProvider -> RootRouter -> TenantProvider/TenantGate -> App` production stack.

### RootErrorBoundary validation

Verdict: **meaningful test improvement, incomplete runtime coverage**

Evidence:
- `playwright/crash-boundary.spec.js` now forces boundary trips, retries, and retry exhaustion.
- `src/visual/RuntimeHarnessApp.jsx` includes a dedicated crash surface for deterministic boundary testing.

Assessment:
- The retry path is now actually exercised instead of being trusted by inspection.
- This still only covers synchronous render crashes. Event-handler errors, async promise failures, and loader-level failures remain outside this validation.

### Shared hook stabilization

Verdict: **real hardening**

Evidence:
- `useAccounts`, `useActivityTemplates`, `useFinCategories`, `useFinRules`, and `usePayees` now memoize their visual fixture references instead of rebuilding unstable fallback objects during render.

Assessment:
- This removes an obvious source of fixture-mode instability and accidental rerender churn.

## 3. Robust fixes vs mitigations

### Robust fixes

- `ProtectedRoute` no longer depends on a ref mutation for auth invalidation.
- The onboarding queue now recomputes payloads at execution time from committed state.
- Shared fixture hooks are materially more stable under React 18 rerender behavior.
- Crash-boundary retry behavior is now at least tested instead of assumed.

### Mitigations and partial fixes

- Tenant ownership is still mostly singleton-driven.
- Runtime Playwright coverage still runs a custom harness, not the full production root.
- `RootErrorBoundary` remains a render-crash containment tool, not general async/runtime fault isolation.
- Onboarding persistence still relies on last-write-wins server semantics across tabs/actors.

## 4. ProtectedRoute evaluation

The previous failure was architectural: a mutable ref held “was ever authenticated” state, but changing it did not rerender the route. That bug is gone.

Current behavior is materially better:
- Auth hydration can suppress the initial flicker.
- Once initialized, auth loss immediately flips rendering back to the login route.
- Logout during navigation is no longer dependent on incidental parent rerenders.

Remaining caveat:
- `authInitialized` is intentionally one-way. If `loading` becomes `true` again later, the route does not re-enter the loading state. That is acceptable only if `AuthContext` guarantees that post-init loading is not a distinct user-facing state that must remount a guard.

Conclusion: this is a real fix, not another mitigation layer.

## 5. Onboarding concurrency evaluation

Phase 26 still built payloads before enqueueing them. That guaranteed stale writes under overlapping updates. Phase 27 fixes that specific defect.

What is now correct:
- Queued mutations derive from the latest committed local state.
- Rapid checklist updates no longer send obsolete snapshots.
- Mixed mutation sequences are less likely to trample each other locally.
- Failed mutations no longer poison the queue ordering logic in the same way.

What is still not solved:
- Multi-tab and multi-user conflicts are still last-write-wins.
- There is no version token, compare-and-swap, or server merge discipline.
- Retry safety is still bounded by the storage model, not by the queue itself.

Conclusion: single-client concurrency is materially safer. Cross-client correctness is still weak.

## 6. Tenant ownership evaluation

This is the weakest part of the Phase 27 narrative.

What improved:
- Bootstrap-related calls now accept explicit `tenantId`.
- `App.jsx` threads tenant identity into the most timing-sensitive startup paths.

What did not improve enough:
- `workspaceCore` still exposes an implicit global tenant fallback.
- The broader architecture still allows data access to depend on singleton state rather than explicit ownership.
- Timing ambiguity is reduced at bootstrap, not removed across the system.

Conclusion: this is incremental ownership cleanup, not real ownership reform.

## 7. Real runtime Playwright assessment

The Playwright story is better, but the report oversells it.

What is now valid:
- There is finally a runtime path that exercises `ProtectedRoute` with auth and tenant providers.
- Boundary retry and auth transition behavior are exercised in-browser.
- `npm.cmd run test:visual` is genuinely green, not silently broken.

What is still synthetic:
- The harness bypasses the real `AuthProvider`.
- The harness bypasses `RootRouter`.
- The harness bypasses `TenantProvider`, `TenantGate`, and real app bootstrap sequencing.
- Tests run against the Vite dev server, not a production preview build.

Report mismatch:
- The Phase 27 markdown claims `runtime-hardening.spec.js` contains 25 specs per platform. The checked-in file still defines 16 specs per platform. The total suite result is real, but the report’s breakdown is inflated.

Conclusion: there is now a realer runtime harness, not a real production-runtime validation path.

## 8. RootErrorBoundary assessment

The boundary is more honestly tested now.

Validated behavior:
- Render crash falls into the root fallback.
- Retry re-renders the subtree.
- Repeated failures consume the retry budget.
- Exhaustion disables further retry and shows deterministic failure UI.

Remaining weaknesses:
- Async failures still bypass normal React error boundary semantics.
- Event-handler exceptions are still outside this containment model.
- Lazy import failure handling is not comprehensively validated by the new crash tests.
- Retry budget is boundary-lifetime state, not a richer recovery policy.

Conclusion: improved confidence, still incomplete crash isolation.

## 9. Shared hook stability assessment

This phase materially cleaned up the remaining obvious fixture-hook instability.

Good:
- Memoized fixture references reduce fallback object churn.
- React 18 rerenders are less likely to trigger unnecessary effect invalidation in these hooks.

Not enough to declare victory:
- This only addresses the hook subset touched in Phase 27.
- The broader app still depends on many effect-driven async hooks whose safety comes from discipline, not from a stronger data model.

Conclusion: useful hardening, not systemic simplification.

## 10. React 18 safety evaluation

Phase 27 is materially safer under React 18 than Phase 26.

Improved:
- Auth invalidation now respects rerender semantics.
- Onboarding queue work is no longer closure-stale by construction.
- Fixture hooks are less vulnerable to unstable render identity.

Still exposed:
- Tenant ownership remains partly timing-sensitive because implicit global lookup still exists.
- Boundary coverage still does not address async/event failure classes.
- Playwright does not validate the full real provider tree under concurrent route and hydration behavior.

Conclusion: React 18 correctness improved in targeted areas. It is not comprehensively hardened.

## 11. Runtime performance integrity validation

Validation results:
- `npm.cmd run build` passed.
- Production build still code-splits correctly.
- `RuntimeHarnessApp` does not leak into production assets, so the dev-only gate in `src/main.jsx` is working.

No evidence found of:
- eager-loading regressions
- rerender storms introduced by the new fixes
- startup cost explosion from the new harness code

Limitations:
- Playwright still validates dev-server behavior, not production asset serving or chunk failure behavior in preview mode.

Conclusion: performance integrity appears preserved.

## 12. Architectural sustainability assessment

Phase 27 improved correctness more than the previous ownership phases, but the architecture is still split between real fixes and ongoing mitigation layers.

Positive direction:
- Auth guard correctness is cleaner.
- Onboarding mutation semantics are more defensible.
- Runtime tests now validate more than screenshots and static fixtures.

Negative reality:
- Tenant ownership is still not explicit enough.
- The harness strategy still depends on synthetic provider composition.
- Recovery remains boundary-centric instead of being backed by broader runtime fault isolation and deterministic ownership boundaries.

Conclusion: the system is getting cleaner in spots, but stabilization debt still exists.

## 13. Production-readiness evaluation

NexusCRM is safer than it was in Phase 26.

What can now be said honestly:
- It is more auth-safe.
- It is more onboarding-safe for single-client concurrency.
- It is more regression-protected than before.

What still blocks a strong production trust rating:
- Tenant-sensitive behavior still leans on implicit ownership.
- Cross-client onboarding correctness is still weak.
- Full-stack runtime orchestration is still not exercised by the real app root in Playwright.

Conclusion: production readiness improved, but “fully trustworthy for aggressive expansion” is still an overstatement.

## 14. Remaining technical debt

- Implicit tenant resolution remains embedded in `workspaceCore`.
- Real app-root runtime coverage is still missing from Playwright.
- `RootErrorBoundary` still lacks meaningful coverage for async/event-driven failure classes.
- Onboarding persistence still lacks server-side conflict control.
- Runtime ownership is still split between explicit threading and singleton fallback.

## 15. Risk severity classification

### High

- Implicit tenant ownership across the shared workspace layer can still produce hidden coupling and future timing regressions.
- Onboarding persistence is still vulnerable to cross-tab or cross-actor last-write-wins overwrites.

### Medium

- Playwright runtime validation is still harness-based rather than full-root production topology.
- `RootErrorBoundary` validation still excludes major runtime error classes.

### Low

- Report accuracy is not clean; the runtime-hardening spec count is overstated.
- The one-way `authInitialized` policy could become a UX edge case if `AuthContext` semantics change later.

## 16. Whether feature expansion is now safer or still premature

Feature expansion is safer than it was in Phase 26, but still premature for work that increases tenant complexity, auth transitions, or shared onboarding state pressure.

Low-risk UI expansion is reasonable.

Tenant-sensitive or concurrency-sensitive expansion should wait until:
- tenant ownership is made explicit across the data layer
- the real app root is exercised in browser automation
- onboarding persistence gets stronger conflict semantics

## 17. Whether rollback remains unjustified

Rollback remains unjustified.

Phase 27 contains real improvements and does not appear to have damaged chunking, baseline performance, or test stability. The correct decision is not rollback. The correct decision is to stop pretending ownership cleanup is complete and run a narrower Phase 28 focused on:
- explicit tenant ownership across `workspaceCore`
- real app-root Playwright runtime coverage
- async/runtime fault containment beyond render-only boundary recovery
- server-side onboarding conflict control

## Validation evidence

- `npm.cmd run lint`: passed
- `npm.cmd test`: passed, `47 files`, `172 tests`
- `npm.cmd run build`: passed, `2118 modules transformed`, build completed in `12.31s`
- `npm.cmd run test:visual`: passed, `111 passed` in `40.3s`
