# PHASE 28 — Explicit Tenant Ownership & Real Runtime Topology

**Branch:** main  
**Date:** 2026-05-15  
**Status:** COMPLETE ✅

---

## 1. Executive Summary

Phase 28 closes the implicit-tenantId gap in the workspace data layer, validates the full app topology through a real Playwright harness, and hardens async fault isolation paths. All 34 public functions in `workspaceCore.js` now accept an explicit `tenantId` parameter, eliminating reliance on the module-level singleton as the sole resolution path. Two new Playwright spec files add 17 tests covering real topology orchestration and 7 stress-path scenarios. Runtime observability received four new trace functions gated behind the existing diagnostics flag.

---

## 2. Explicit Tenant Ownership Improvements

### Problem
All 34 functions in `workspaceCore.js` called `getRequiredActiveTenantId()` implicitly — a module-level singleton `currentActiveTenantId` that any component could overwrite. Callers had no mechanism to pass a tenantId derived from React context; they relied entirely on the global side-effect being set before their call executed.

### Solution
Every public function now accepts `tenantId` as its last (optional) parameter:

```js
export async function createTaskRecord(task, tenantId) {
  return workspaceCoreRequest('/tasks', { method: 'POST', body: task, tenantId, ... })
}
```

Inside `workspaceCoreRequest`, resolution is unchanged:
```js
const resolvedTenantId = tenantId ?? getRequiredActiveTenantId()
```

Full backward compatibility: callers that omit `tenantId` continue to work via the implicit singleton fallback.

### Call-sites updated in App.jsx
- `createTaskRecord(payload, activeTenantId)`
- `updateTaskRecord(id, updates, activeTenantId)`
- `deleteTaskRecord(id, activeTenantId)`
- `archiveTaskRecord(id, activeTenantId)`
- `restoreTaskRecord(id, activeTenantId)`
- `createColumnRecord({...}, activeTenantId)`
- `deleteColumnRecord(id, activeTenantId)`
- `listActiveAccounts(activeTenantId)`

---

## 3. Hook Ownership Continuation

### useActivities
Signature changed from `useActivities()` to `useActivities({ tenantId } = {})`. All three `workspaceCore` calls (`listActivityRecords`, `saveActivityRecord`, `deleteActivityRecord`) now forward the explicit `tenantId`. The value is included in the `useEffect` dependency array so the hook re-fetches when the tenant changes.

### useReceivables
Signature changed from `useReceivables()` to `useReceivables({ tenantId } = {})`. All data operations (`listReceivableRecords`, `createReceivableRecord` × 2, `updateReceivableRecord`) forward the explicit `tenantId`. Added to `useCallback` dependencies.

### App.jsx wire-up
```jsx
const activities = useActivities({ tenantId: activeTenantId })
const receivables = useReceivables({ tenantId: activeTenantId })
```

---

## 4. Real App Runtime Topology Implementation

### Harness architecture
`RuntimeHarnessApp.jsx` now includes `AppTopologyShell`, which mounts the complete production topology with deterministic fixture values:

```
AuthContext.Provider (FIXTURE_AUTH_VALUE)
  └── ProtectedRoute
        └── TenantContext.Provider (FIXTURE_TENANT_VALUE)
              └── TenantGate
                    └── App
```

Four harness modes added (`?runtime-harness=1&harness-mode=…`):
| Mode | Auth | Tenant |
|------|------|--------|
| `app-topology` | Authenticated | Loaded |
| `app-topology-unauthenticated` | Not authenticated | N/A |
| `app-topology-tenant-loading` | Authenticated | Loading |
| `app-topology-tenant-error` | Authenticated | Error |

### MockProviders.jsx
New `src/visual/MockProviders.jsx` exports `MockAuthProvider` and `MockTenantProvider` for unit-test-level topology testing with override support.

---

## 5. Bootstrap Orchestration Validation

`app-topology.spec.js` validates five bootstrap scenarios:

1. **Authenticated + tenant loaded** → sidebar renders, no error boundary
2. **Bootstrap resolves** → loading screen disappears (does not hang)
3. **Unauthenticated** → login page renders, no sidebar
4. **Tenant loading** → TenantGate shows "Carregando espaços de trabalho"
5. **Tenant error** → TenantGate shows "Erro ao carregar espaços de trabalho" with retry button

Plus transition scenarios: auth loss, tenant navigation, and the full cycle (auth-lost → re-auth → tenant-error → authenticated).

The bootstrap `useEffect` in `App.jsx` now calls `traceBootstrap('start' | 'ready' | 'error' | 'cancelled', activeTenantId)` for observability.

---

## 6. Async Fault Isolation Hardening

### RootErrorBoundary limitations documented
`RootErrorBoundary.jsx` now has explicit JSDoc noting what the boundary does NOT catch:
- Unhandled promise rejections
- Event handler errors
- setTimeout/setInterval callbacks
- Errors in asynchronous code outside the render tree

### Unhandled rejection logging
`componentDidMount` installs a `window.unhandledrejection` listener that logs the event. The listener is removed in `componentWillUnmount`. This is logging only — no recovery is attempted, which is honest about the boundary's actual capability.

### lazyWithRetry.js
Added `console.warn` before the chunk-reload path and `console.error` before the re-throw path, so both paths are visible in DevTools without silent failures.

---

## 7. Runtime Observability Improvements

Four new trace functions added to `src/lib/diagnostics.js`, all gated behind `isEnabled()` (`window.__NEXUS_DIAG__ = true`):

| Function | When to use |
|---|---|
| `traceBootstrap(phase, tenantId, detail)` | App bootstrap lifecycle events |
| `traceOwnership(operation, tenantId, source)` | Explicit vs implicit tenant resolution |
| `traceAsyncFailure(type, error, context)` | Unhandled async errors |
| `traceRouteTransition(from, to, phase)` | Route transition start/commit/end |

`TenantContext.jsx` updated to call `traceBootstrap` during `loadTenants()` and `traceTenant('active-tenant-changed', ...)` on `activeTenantId` changes.

---

## 8. Playwright Stress Paths

`stress-paths.spec.js` adds 7 determinism-under-pressure tests:

| # | Scenario | Key validation |
|---|---|---|
| 1 | Rapid route switching (8 surfaces) | No `.root-error-boundary` |
| 2 | Rapid tenant-state changes (5 URLs) | No `.root-error-boundary` |
| 3 | Repeated auth on/off (5 cycles) | No `.root-error-boundary` |
| 4 | Command palette open/close during navigation | No `.root-error-boundary` |
| 5 | Burst of lazy surface navigations (7) | No boundary + non-empty body |
| 6 | Navigation to surface after prior rapid switch | No boundary + sidebar visible |
| 7 | Onboarding + navigation overlap | No `.root-error-boundary` |

All stress tests run against both `?visual-regression=1` (full fixture data) and `?runtime-harness=1` (auth/tenant transitions) harnesses as appropriate.

---

## 9. Files Changed

### Modified
| File | Change |
|---|---|
| `src/lib/workspaceCore.js` | All 34 public functions accept optional `tenantId` |
| `src/App.jsx` | Explicit tenantId at all call-sites; hook signatures updated; traceBootstrap wired |
| `src/hooks/useActivities.js` | `{ tenantId }` param threading |
| `src/hooks/useReceivables.js` | `{ tenantId }` param threading |
| `src/lib/diagnostics.js` | 4 new trace functions appended |
| `src/context/TenantContext.jsx` | traceBootstrap + traceTenant calls |
| `src/components/shared/RootErrorBoundary.jsx` | JSDoc + unhandledrejection listener |
| `src/lib/lazyWithRetry.js` | warn/error logging before reload/rethrow |
| `src/visual/RuntimeHarnessApp.jsx` | AppTopologyShell + 4 new harness modes |

### Created
| File | Purpose |
|---|---|
| `src/visual/MockProviders.jsx` | MockAuthProvider + MockTenantProvider |
| `playwright/app-topology.spec.js` | 10 real topology Playwright tests |
| `playwright/stress-paths.spec.js` | 7 stress-path Playwright tests |
| `docs/superpowers/plans/2026-05-14-phase-28-tenant-ownership-runtime-topology.md` | Implementation plan |

---

## 10. Tests Added

### Unit tests (`workspaceCore.test.js`)
3 new tests in `describe('workspaceCore — explicit tenantId threading')`:
- With explicit tenantId → does NOT call `getRequiredActiveTenantId`
- With explicit tenantId → passes it to `authenticatedFetch`
- Without tenantId → falls back to `getRequiredActiveTenantId`

### Playwright tests
- `app-topology.spec.js`: 10 tests × 3 viewports = 30 test runs
- `stress-paths.spec.js`: 7 tests × 3 viewports = 21 test runs

---

## 11. Validation Commands

```
npm run lint        → 0 errors, 0 warnings ✅
npm run test        → 175/175 tests pass ✅
npm run build       → 2119 modules, 0 errors ✅
npm run test:visual → 162/162 tests pass ✅
```

---

## 12. Validation Results

| Suite | Tests | Result |
|---|---|---|
| ESLint | — | PASS (0 errors) |
| Vitest unit | 175 | PASS |
| Vite build | 2119 modules | PASS |
| Playwright (desktop) | 54 | PASS |
| Playwright (tablet) | 54 | PASS |
| Playwright (mobile) | 54 | PASS |
| **Total Playwright** | **162** | **PASS** |

---

## 13. Remaining Debt

- **Implicit singleton still live**: `activeTenant.js` still exports `currentActiveTenantId` as a module-level global. It is now only the fallback path, but it has not been removed. Future phase: migrate remaining non-hook call-sites and retire the singleton.
- **No useTeams / useClients explicit threading**: hooks added in Phase 25–26 were not in scope for Phase 28 ownership threading. They still rely on the implicit global.
- **MockProviders not yet used in unit tests**: `MockAuthProvider` / `MockTenantProvider` were created for Phase 28 but existing unit tests still use direct `AuthContext.Provider` wrappers. Future phase: migrate for consistency.

---

## 14. Runtime Risks

- **Bootstrap failure is expected in harness**: The app-topology harness has no active Supabase session. `fetchWorkspaceBootstrap` will fail with an auth error. This is caught by App's `useEffect` error handler. The tests validate topology orchestration, not data correctness.
- **`unhandledrejection` listener**: The listener added to `RootErrorBoundary` fires on every unhandled rejection in the page — including those from third-party scripts. It logs but does not swallow, so no false-positive suppression occurs.
- **lazyWithRetry reload race**: The chunk reload on ChunkLoadError triggers `window.location.reload()` which abandons in-flight requests. The one-retry guard via sessionStorage prevents infinite reload loops.

---

## 15. Architectural Limitations

React Error Boundaries, by design, catch only errors thrown during:
- Component render
- Lifecycle methods (`componentDidMount`, `componentDidUpdate`)
- Constructor

They explicitly do NOT catch:
- Event handlers
- Asynchronous code (setTimeout, Promises, async/await outside render)
- Server-side rendering
- Errors in the boundary component itself

The `unhandledrejection` listener in `RootErrorBoundary` addresses the async gap for logging purposes only. No React mechanism exists to recover from async errors through the boundary; that requires manual `try/catch` at the async call-site.

---

## 16. Production Readiness

Phase 28 is safe to deploy. No visual changes, no API contract changes, no data migrations. All changes are either:
- Additive (new parameters with `??` fallback — fully backward compatible)
- Internal (logging, diagnostics gated behind `__NEXUS_DIAG__`)
- Test infrastructure (harness modes, spec files)

The ownership improvements reduce the surface area for tenant data leakage across user sessions. The real topology harness provides a regression baseline for the full authentication + tenant + app chain.

---

## 17. Feature Expansion Safety

Any new hook that fetches workspace data must:
1. Accept `{ tenantId }` as a named parameter with default `{}`
2. Forward the `tenantId` to every `workspaceCore` call
3. Include `tenantId` in the `useEffect` / `useCallback` dependency array
4. Be wired at the App.jsx call-site with `{ tenantId: activeTenantId }`

Any new `workspaceCore` function must:
1. Accept `tenantId` as the last parameter
2. Pass it to `workspaceCoreRequest` — the resolver handles fallback automatically
