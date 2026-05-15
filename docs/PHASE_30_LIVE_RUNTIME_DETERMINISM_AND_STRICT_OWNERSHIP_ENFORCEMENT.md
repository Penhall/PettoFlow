# PHASE 30 — Live Runtime Determinism & Strict Ownership Enforcement

## 1. Executive summary

Phase 30 closed the biggest remaining lie in the runtime model: tenant switching no longer "passes" by remounting the entire app tree.

The meaningful changes were:

- strict tenant ownership is now enforceable in dev/test through `window.__NEXUS_STRICT_OWNERSHIP__`
- every implicit `workspaceCore` fallback is now observable and classified
- `fetchTeam` and `fetchClients` are now protected against stale cross-tenant commits in a live mounted runtime
- mounted-runtime stress coverage now exercises one persistent provider tree under tenant switches, auth flips, lazy-route churn, overlay interruption, bootstrap retry storms, and stale async responses
- async runtime failures are classified more explicitly instead of disappearing into generic console noise

This phase materially improves runtime determinism. It does not finish ownership purity. Production still allows implicit tenant fallback when strict mode is off. That is intentional debt, not solved debt.

## 2. Strict ownership enforcement implementation

- `src/lib/workspaceCore.js` now distinguishes explicit tenant usage from implicit fallback at the request boundary.
- Missing `tenantId` under strict mode throws `STRICT_TENANT_OWNERSHIP_REQUIRED` before any fallback or network request.
- Missing `tenantId` outside strict mode still falls back to `getRequiredActiveTenantId()`, but that path is now traced, classified, and no longer silent.
- The most important shared hooks now short-circuit when `tenantId` is absent instead of quietly tunneling into singleton fallback.

## 3. Strict-mode behavior

- Strict mode is activated with `window.__NEXUS_STRICT_OWNERSHIP__ = true`.
- In that mode, `workspaceCoreRequest()` rejects omitted-tenant calls immediately.
- Playwright now validates a real production runtime path with strict mode enabled and confirms main navigation does not hit implicit workspace-core fallback.
- Unit coverage exists for the strict throw path in `src/lib/workspaceCore.test.js`.

## 4. Implicit fallback observability improvements

- `src/lib/diagnostics.js` now records bounded runtime events in `window.__NEXUS_DIAG_EVENTS__`.
- Ownership tracing records whether each workspace-core call was `explicit` or `implicit`.
- Implicit fallback warnings are deduped for console noise control, but the event stream still captures them.
- Caller frame capture is included where feasible in dev/strict contexts.

## 5. `fetchTeam` / `fetchClients` race-condition hardening

- `src/App.jsx` now uses scope-specific request sequencing for team/client refreshes.
- Each refresh records `start`, `resolve`, or `cancel`.
- Commits are dropped when either:
  - a newer request superseded the old one
  - the active tenant changed before the old response resolved
- This only became real after removing the tenant-keyed app remount in `src/RootRouter.jsx`.

Before that change, the app cheated by destroying the old tree on every tenant switch. That hid stale-commit risk instead of handling it.

## 6. Mounted-runtime stress validation

New or expanded mounted-runtime coverage now validates:

- repeated tenant switching inside one live runtime tree
- auth invalidation and recovery without full reload
- rapid in-app route transitions
- repeated lazy-route transitions
- overlay interruption during transitions
- onboarding mutation during navigation
- bootstrap retry storms
- concurrent startup interruptions
- stale team refresh cancellation across tenant switching
- stale client refresh cancellation across tenant switching

The stale team/client tests now prove cancellation in a persistent mounted runtime. They were impossible to validate honestly while `App` was keyed by tenant.

## 7. Runtime determinism findings

What improved:

- tenant switches no longer force `App` remount
- pending route transitions are explicitly interrupted on tenant changes
- transient UI state is cleaned up on tenant switches instead of being implicitly discarded by remount
- stale async responses from team/client refreshes no longer overwrite the current tenant view

What remains true:

- bootstrap still relies on effect-driven async sequencing, not a centralized state machine
- tenant switching still reuses the mounted app state intentionally, so future tenant-sensitive local state must be coded carefully

## 8. RootErrorBoundary async validation

`src/components/shared/RootErrorBoundary.jsx` now observes:

- `unhandledrejection`
- `window.error`

Coverage added in `playwright/root-error-boundary-async.spec.js` validates:

- unhandled async rejection classification without false claims that the boundary caught it
- async event failure classification
- rejected lazy imports surfacing through the root boundary with diagnostics

This is better observability, not magical async containment. React error boundaries still do not catch arbitrary async failures automatically.

## 9. Playwright realism improvements

- `playwright/production-runtime.spec.js` now checks strict ownership inside the real main runtime path.
- `playwright/runtime-mounted-stress.spec.js` now keeps pressure inside one mounted runtime session instead of relying on `page.goto()` churn.
- The important correction in this phase was architectural, not just test-side: removing the tenant-key remount made the stress suite honest.

## 10. Hook contract enforcement findings

The following hooks now refuse to operate as silent implicit-tenant tunnels when `tenantId` is missing:

- `useActivities`
- `useReceivables`
- `useAccounts`
- `useActivityTemplates`
- `useFinCategories`
- `useFinRules`
- `usePayees`
- `useTransactions`

This is a real contract tightening. It is still partial because production fallback remains available in lower layers when older call sites bypass the migrated hooks.

## 11. Files changed

- `src/App.jsx`
- `src/RootRouter.jsx`
- `src/lib/workspaceCore.js`
- `src/lib/diagnostics.js`
- `src/lib/workspaceCore.test.js`
- `src/components/shared/RootErrorBoundary.jsx`
- `src/visual/RuntimeHarnessApp.jsx`
- `src/hooks/useActivities.js`
- `src/hooks/useReceivables.js`
- `src/hooks/useAccounts.js`
- `src/hooks/useActivityTemplates.js`
- `src/hooks/useFinCategories.js`
- `src/hooks/useFinRules.js`
- `src/hooks/usePayees.js`
- `src/hooks/useTransactions.js`
- `playwright/production-runtime.spec.js`
- `playwright/runtime-mounted-stress.spec.js`

## 12. Tests added or materially expanded

- strict ownership unit coverage in `src/lib/workspaceCore.test.js`
- async root-boundary runtime coverage in `playwright/root-error-boundary-async.spec.js`
- strict-ownership real-runtime Playwright coverage in `playwright/production-runtime.spec.js`
- mounted-runtime stale-response cancellation coverage in `playwright/runtime-mounted-stress.spec.js`

## 13. Commands executed

- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run test:visual -- playwright/production-runtime.spec.js playwright/runtime-mounted-stress.spec.js playwright/root-error-boundary-async.spec.js playwright/crash-boundary.spec.js`
- `npm.cmd run test:visual`

## 14. Validation results

- `npm.cmd run lint` passed
- `npm.cmd test` passed: `47 files`, `176 tests`
- `npm.cmd run build` passed: `2117 modules transformed`
- targeted runtime/browser slice passed: `78 tests`
- `npm.cmd run test:visual` passed: `222 tests`

Observed non-failing noise:

- Vite/Vitest emitted deprecation warnings about `esbuild` plugin options
- `useAuth` guard errors still print during the intentional outside-provider test path

Neither blocked the phase.

## 15. Remaining ownership debt

- production still permits implicit tenant fallback when strict mode is off
- not every historical call site has been forced onto explicit ownership yet
- ownership purity is not complete until fallback removal becomes the default runtime contract

## 16. Remaining runtime risks

- tenant-sensitive local UI state can still regress if future features assume remount-on-switch behavior
- async failures are now better classified, but event-handler and network failures still depend on explicit handling by the caller
- bootstrap orchestration is safer, but still decentralized across effects and providers

## 17. Remaining architectural limitations

- strict ownership is progressive, not absolute
- diagnostics are lightweight by design, so they are useful for classification, not full causality reconstruction
- provider/runtime coordination is improved but still not expressed as a single orchestration model

## 18. Production-readiness reassessment

The frontend is in materially better shape for controlled expansion.

Why:

- the runtime is now closer to real mounted behavior under pressure
- tenant switching no longer hides correctness issues behind app remounts
- strict ownership regressions are now catchable early
- stale team/client cross-tenant commits are blocked in live runtime flow

Why caution still matters:

- production fallback still exists
- ownership enforcement is not yet hard-default
- future tenant-sensitive features can still regress if they bypass the explicit contract

## 19. Whether controlled feature expansion is now justified

Yes, controlled expansion is now justified.

Not aggressive expansion.

The app is finally exercising real mounted-runtime semantics instead of remount-based shortcuts, and the highest-risk ownership holes from the previous audit are materially reduced. But the system is still carrying deliberate ownership debt in production fallback mode. The next expansion phases should keep strict-ownership regression coverage on by default in dev/test and continue burning down remaining implicit tenant paths instead of pretending the job is fully finished.
