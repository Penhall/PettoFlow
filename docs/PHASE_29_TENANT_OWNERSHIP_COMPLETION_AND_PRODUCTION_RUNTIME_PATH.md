# PHASE_29_TENANT_OWNERSHIP_COMPLETION_AND_PRODUCTION_RUNTIME_PATH

## 1. Executive summary

Phase 29 materially improved runtime determinism.

- Explicit `tenantId` threading now covers the highest-risk shared finance, activity, client, and team surfaces.
- Ownership fallback is no longer invisible. `workspaceCoreRequest()` now traces whether each request used explicit ownership or implicit fallback, and it classifies the workspace surface.
- A real provider-graph Playwright path now runs through `src/main.jsx` instead of bypassing the production chain.
- Startup and mounted stress tests now exercise auth hydration, tenant loading, bootstrap failure, retry, tenant switching, overlay churn, and concurrent startup interruption.
- `VisualRegressionApp` no longer ships in production assets.

This is not full tenant-ownership completion in the literal sense.

- The app is still hybrid because `workspaceCoreRequest()` still retains the implicit fallback path.
- Explicit ownership is now the primary path on the critical operational surfaces, but not the only path everywhere.

## 2. Explicit tenant-threading expansion

Migrated hooks to explicit ownership-first signatures:

- `useTransactions({ filters, rules, tenantId })`
- `useAccounts({ tenantId })`
- `useActivityTemplates({ tenantId })`
- `useFinCategories({ tenantId })`
- `useFinRules({ tenantId })`
- `usePayees({ tenantId })`
- `useCalendarEvents({ ..., tenantId })`

Expanded explicit call-site threading across the premium shell:

- `ActivitiesView`
- `FinanceView`
- `CalendarView`
- `TaskModal`
- `ClientProfileModal`
- `ClientesView`
- `TimeView`
- `App.jsx` bootstrap/account flows

`useClients` and `useTeams` do not exist as shared hooks in this codebase. Their operational CRUD paths were migrated at the component layer instead.

## 3. Hooks migrated to explicit ownership

Explicit tenant threading now covers:

- transaction listing and mutations
- account listing and mutations
- payee/category/rule operations
- activity-template operations
- client interaction-log operations
- client save/delete operations
- team save/delete operations
- calendar transaction creation path

The remaining production fallback usage is concentrated in one place:

- `src/lib/workspaceCore.js`

`rg -n "getRequiredActiveTenantId" src` now shows only `activeTenant.js` and the fallback inside `workspaceCore.js` as production runtime usage.

## 4. Ownership diagnostics instrumentation

`workspaceCoreRequest()` now records:

- explicit vs implicit ownership source
- request operation
- resolved tenant id
- workspace scope classification such as `tasks`, `transactions`, `clients`, `bootstrap`

This is lightweight and gated behind `window.__NEXUS_DIAG__`.

This is useful because the remaining hybrid debt is now measurable instead of hidden.

## 5. Real production runtime topology validation

New Playwright runtime validation now exercises the real production entry chain:

- `ThemeProvider`
- `RootErrorBoundary`
- `AuthProvider`
- `ProtectedRoute`
- `RootRouter`
- `TenantProvider`
- `TenantGate`
- `App`

Important constraint:

- data transport is still fixture-backed in runtime-fixture mode
- provider topology is real
- network/backend behavior is simulated

That is the right tradeoff for deterministic runtime orchestration tests. It is no longer the synthetic provider bypass from earlier phases.

## 6. Startup orchestration validation

Startup behavior is now covered by `playwright/production-runtime.spec.js`:

- successful auth hydration
- delayed auth hydration
- auth invalidation during bootstrap
- tenant loading failure and retry
- workspace bootstrap failure and retry
- lazy-tab startup while shell remains stable

This is enough to make startup regressions testable through the real app stack.

## 7. Visual harness production-build removal

`src/main.jsx` no longer statically imports the visual harness provider path into production.

- `VisualRegressionApp` is dev-only
- `VisualHarnessProviders` is now dev-only and lazy
- `RuntimeHarnessApp` remains dev-only

Validation:

- `npm.cmd run build` passed
- `rg -n "VisualRegressionApp|VisualHarnessProviders|RuntimeHarnessApp" dist` returned no matches

That removes the Phase 28 production bundle leak.

## 8. Async failure classification improvements

Diagnostics are now cleanly normalized in `src/lib/diagnostics.js`.

`traceAsyncFailure()` classifies:

- `bootstrap-failure`
- `auth-failure`
- `lazy-load-failure`
- `network-failure`
- `onboarding-failure`
- `transition-failure`
- `unhandled-rejection`
- `async-event`

Instrumentation is wired into:

- auth initialization
- tenant loading
- app bootstrap
- onboarding load/mutation/event flows
- lazy chunk retry failure
- root-level unhandled rejection capture

## 9. Runtime determinism stress testing

New mounted runtime stress coverage in `playwright/runtime-mounted-stress.spec.js` now proves the mounted tree survives:

- repeated tenant switching
- auth invalidation and recovery without reload
- rapid route transitions
- repeated lazy-route transitions
- command-palette/overlay interruption
- onboarding mutation during navigation
- bootstrap retry storms
- concurrent startup interruption

These tests are responsive-shell aware and run on desktop, tablet, and mobile.

## 10. Hook ownership audit findings

What is solid:

- migrated hooks now include `tenantId` in dependency flow
- the high-risk finance and transaction paths no longer depend on implicit tenant lookup at the call-site layer
- backward compatibility was preserved where needed, especially in `useTransactions`

What is still true:

- fallback still exists centrally in `workspaceCoreRequest()`
- the architecture is not yet pure explicit ownership end to end
- future hooks and direct CRUD additions can regress if engineers ignore the explicit path

## 11. Files changed

Key implementation files:

- `src/main.jsx`
- `src/App.jsx`
- `src/lib/workspaceCore.js`
- `src/lib/apiFetch.js`
- `src/lib/diagnostics.js`
- `src/lib/runtimeFixture.js`
- `src/lib/supabaseClient.js`
- `src/lib/lazyWithRetry.js`
- `src/context/AuthContext.jsx`
- `src/context/TenantContext.jsx`
- `src/hooks/useTransactions.js`
- `src/hooks/useAccounts.js`
- `src/hooks/useActivityTemplates.js`
- `src/hooks/useFinCategories.js`
- `src/hooks/useFinRules.js`
- `src/hooks/usePayees.js`
- `src/hooks/useCalendarEvents.js`
- `src/hooks/useOnboarding.js`
- `src/components/Activities/ActivitiesView.jsx`
- `src/components/Finance/FinanceView.jsx`
- `src/components/Calendar/CalendarView.jsx`
- `src/components/Tasks/TaskModal.jsx`
- `src/components/Clients/ClientProfileModal.jsx`
- `src/components/Clients/ClientesView.jsx`
- `src/components/Team/TimeView.jsx`

Test files:

- `playwright/production-runtime.spec.js`
- `playwright/runtime-mounted-stress.spec.js`
- `src/lib/workspaceCore.test.js`
- tenant-context wrappers added to affected view unit tests

## 12. Tests added

- real production runtime startup coverage
- mounted runtime stress coverage
- ownership diagnostics assertions for explicit vs implicit workspace-core requests

## 13. Commands executed

- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run test:visual`
- `rg -n "VisualRegressionApp|VisualHarnessProviders|RuntimeHarnessApp" dist`
- `rg -n "getRequiredActiveTenantId" src`

## 14. Validation results

- `npm.cmd run lint` passed
- `npm.cmd test` passed: `47/47 files`, `175/175 tests`
- `npm.cmd run build` passed: `2117 modules transformed`
- `npm.cmd run test:visual` passed: `204/204 tests`
- production bundle grep passed: no visual harness identifiers in `dist`

## 15. Remaining ownership debt

- implicit fallback still exists in `workspaceCoreRequest()`
- explicit ownership is dominant on migrated surfaces, not universal across all future workspace-core consumers
- tenant-core and non-workspace runtime paths were not redesigned here

## 16. Remaining runtime risks

- a new call-site can still silently rely on fallback unless reviews enforce explicit threading
- runtime-fixture mode validates topology and orchestration, not real backend latency pathologies
- diagnostics remain opt-in and will not help if nobody enables them during incident triage

## 17. Remaining architectural limitations

- this is still a transition architecture
- the global fallback is now observable, but it still exists
- full removal of implicit ownership requires a later phase that makes explicit tenant arguments mandatory across workspace-core consumers

## 18. Production-readiness reassessment

This frontend is now materially safer for production scale than it was in Phase 28.

- startup orchestration is testable
- provider topology is validated
- critical tenant-sensitive operational flows are explicit
- stress coverage exists across responsive shells

This does not justify claiming "fully explicit multi-tenant architecture" yet.

## 19. Whether aggressive feature expansion is now safer

Yes, but only in a qualified sense.

- tenant-aware feature work on the migrated operational surfaces is now much safer
- aggressive expansion is still premature if it introduces new workspace-core consumers that keep leaning on implicit fallback
- rollback remains unjustified
- the next stabilization phase should remove or hard-fail the remaining implicit fallback path once all workspace-core consumers are explicitly threaded
