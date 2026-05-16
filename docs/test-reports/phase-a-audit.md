# Independent Audit Report — Commit 06aa781
**Files:** `src/App.jsx`, `src/context/AuthContext.jsx`
**Auditor:** Independent Principal Auditor
**Date:** 2026-05-16
**Verdict:** FAIL — 2 HIGH findings require fixes before ship

## 1. Executive Assessment

The commit introduces hash-based navigation, signout hardening, and an admin route guard. Two of the three changes contain confirmed regressions or unsafe behaviors. The third (H-02) is mostly sound but has a latent authorization gap.

| Criterion | Status | Severity |
|-----------|--------|----------|
| H-01 signOut | FAIL | HIGH + MEDIUM |
| H-02 admin route guard | CONDITIONAL PASS | MEDIUM |
| H-03 hashchange | FAIL | HIGH + MEDIUM |
| Lint | PASS | — |
| Tests | PASS (260/260) | — |
| Build | INCONCLUSIVE (env perm error) | — |

---

## 2. Findings by Severity

### HIGH-1 — localStorage.clear() Nukes User Preferences on Every Signout
**File:** src/context/AuthContext.jsx:205

localStorage.clear() removes ALL keys without discrimination. Confirmed collateral damage:

| Key destroyed | Owner | Impact |
|---|---|---|
| pettoflow_theme | ThemeContext.jsx:18,33 | User dark/light theme reset on every signout |
| nexus_flags | featureFlags.js:42,80 | Developer/admin feature flag overrides wiped |
| nexuscrm_active_tenant_id | activeTenant.js:7,14 | Tenant cleared (desired, but Supabase handles its own auth keys) |
| sb-* keys | Supabase SDK | Redundant — already removed by supabase.auth.signOut({ scope: 'local' }) |

Supabase signOut() already removes its own session tokens. The additional localStorage.clear() is redundant for auth and destructive for non-auth state.

Evidence — AuthContext.jsx:202-207:
```
const { error } = await supabase.auth.signOut({ scope: 'local' })
if (error) throw error
setMfaChallenge(null)
localStorage.clear()    // nuclear: kills theme, feature flags, etc.
sessionStorage.clear()
window.location.href = '/'
```

Evidence — ThemeContext.jsx:18,33:
```
const savedTheme = localStorage.getItem('pettoflow_theme')
localStorage.setItem('pettoflow_theme', theme)
```

Evidence — featureFlags.js:42,80:
```
const raw = window.localStorage.getItem('nexus_flags')
window.localStorage.setItem('nexus_flags', JSON.stringify(next))
```

---

### HIGH-2 — handler() Immediate Invocation Breaks ?tab= URL Param Navigation
**File:** src/App.jsx:532-542

The hashchange useEffect calls handler() immediately on every run. The handler uses:
  window.location.hash.slice(1) || 'dashboard'
When there is no hash, it always defaults to 'dashboard', overriding any ?tab= URL param already loaded into activeTab.

Confirmed reproduction path:
1. User navigates to /?tab=tarefas (no hash in URL)
2. readInitialAppTab() correctly returns 'tarefas'; activeTab = 'tarefas'
3. handleTabChange is created; useEffect runs; handler() is invoked immediately
4. hash = '' || 'dashboard' → handleTabChange('dashboard') is called
5. nextTab='dashboard' !== activeTab='tarefas' → no early return; full navigation fires
6. window.location.hash = 'dashboard' is set; setActiveTab('dashboard') queued
7. RESULT: user lands on Dashboard instead of Tarefas — confirmed regression vs HEAD~1

Additionally, handleTabChange is a useCallback with activeTab in its deps — it is recreated on every tab change. The useEffect re-runs on every navigation, calling handler() again. Without a hash, the 'dashboard' forced navigation repeats.

Evidence — App.jsx:532-542:
```
useEffect(() => {
  const handler = () => {
    const hash = window.location.hash.slice(1) || 'dashboard'  // 'dashboard' when no hash
    if (isValidTab(hash)) {
      handleTabChange(hash)  // called with 'dashboard' even if activeTab is 'tarefas'
    }
  }
  window.addEventListener('hashchange', handler)
  handler()  // fires immediately on mount AND on every re-run triggered by tab changes
  return () => window.removeEventListener('hashchange', handler)
}, [handleTabChange])  // handleTabChange recreated every time activeTab changes
```

Evidence — App.jsx:488-530:
```
const handleTabChange = useCallback((tab) => {
  ...
}, [activeTab, closePalette, interruptTransition, startRuntimeTransition])
// activeTab in deps → new function reference on every tab change → effect re-runs
```

---

### MEDIUM-1 — scope:'local' Inconsistent with Nuclear localStorage Clear
**File:** src/context/AuthContext.jsx:202

signOut({ scope: 'local' }) intentionally leaves sessions on other devices alive. Yet the code then calls localStorage.clear() and sessionStorage.clear() — a total local wipe inconsistent with the conservative server-side scope. On shared devices, the server-side session token remains valid; any other device or tab that refreshes before expiry remains authenticated.

---

### MEDIUM-2 — closePalette() Called as Side Effect of Every Tab Change via Effect Re-Run
**File:** src/App.jsx:498, 500, 532-542

Because useEffect calls handler() immediately on every re-run, and handleTabChange is recreated on every activeTab change, every navigation causes an extra invocation of handleTabChange(currentHash). The nextTab === activeTab guard fires — but only after closePalette() and setPendingSettingsTab(null) are already called:

```
// App.jsx:488-502
closePalette()                      // line 498 — called BEFORE same-tab guard
if (nextTab !== 'settings') {
  setPendingSettingsTab(null)       // line 500 — called BEFORE same-tab guard
}
if (nextTab === activeTab) return   // line 502 — guard is here, too late
```

If the command palette is open and the user clicks the currently-active nav item, the palette is closed unexpectedly.

---

### MEDIUM-3 — Admin Route Guard Missing isPlatformAdmin Authorization Check
**File:** src/App.jsx:70-71, 793-794, 1076-1080

isAdminRoute(tab) is a pure string prefix check. Neither the bootstrap error bypass (line 794) nor the switch cases (lines 1076-1080) verify isPlatformAdmin before rendering admin components:

```
// App.jsx:793-794
if (bootstrapError && !isAdminRoute(activeTab)) { // any user on admin hash bypasses error

// App.jsx:1076-1080 — no isPlatformAdmin guard
case 'admin-dashboard': return <AdminDashboard />
case 'admin-tenants':   return <TenantsPage />
case 'admin-audit':     return <AuditPage />
case 'admin-plans':     return <PlansPage />
case 'admin-diagnostics': return <DiagnosticsPanel />
```

A non-admin user who types #admin-dashboard in the address bar bypasses the bootstrap error screen and sees the admin component. This is a pre-existing gap, but the new onOpenAdmin prop (line 1112) makes admin entry paths more reachable. Authorization must be enforced server-side inside each admin component via Supabase RLS.

---

### LOW-1 — isValidTab Accepts Arbitrary admin-* Strings Not in VALID_TABS
**File:** src/App.jsx:74-76

isAdminRoute adds an open-ended wildcard for any 'admin-*' string. Navigating to #admin-anything passes isValidTab, updates the URL hash, clears search state, and renders null (default switch case). The user sees a blank content area with no error or feedback.

---

### LOW-2 — Hash Updated and Palette Closed on Same-Tab Click
**File:** src/App.jsx:492-502

window.location.hash and closePalette() are called before the nextTab === activeTab guard:
```
if (typeof window !== 'undefined' && window.location.hash.slice(1) !== nextTab) {
  window.location.hash = nextTab  // called before guard
}
closePalette()                    // called before guard — closes palette on same-tab click
...
if (nextTab === activeTab) return  // guard is here
```

---

## 3. Line-by-Line Evidence Summary

| Finding | File | Lines | Evidence |
|---------|------|-------|---------|
| HIGH-1: localStorage.clear() | AuthContext.jsx | 202-207 | scope:'local' + localStorage.clear() |
| HIGH-1: theme wiped | ThemeContext.jsx | 18, 33 | localStorage.getItem/setItem('pettoflow_theme') |
| HIGH-1: flags wiped | featureFlags.js | 42, 80 | localStorage.getItem/setItem('nexus_flags') |
| HIGH-2: forced 'dashboard' | App.jsx | 534 | hash || 'dashboard' |
| HIGH-2: handler() immediate | App.jsx | 540 | handler() before listener |
| HIGH-2: effect dep on activeTab | App.jsx | 530, 542 | useCallback([activeTab,...]) + [handleTabChange] |
| MEDIUM-1: local scope inconsistency | AuthContext.jsx | 202 | scope: 'local' |
| MEDIUM-2: closePalette before guard | App.jsx | 498-502 | order of calls |
| MEDIUM-3: no isPlatformAdmin guard | App.jsx | 794, 1076-1080 | switch cases |
| LOW-1: isAdminRoute wildcard | App.jsx | 70-76 | tab.startsWith('admin-') |
| LOW-2: hash+palette before guard | App.jsx | 492-502 | order of operations |

---

## 4. Validation Results

### Lint
```
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
Exit 0 — PASS. No warnings or errors.
```

### Tests
```
Test Files  56 passed (56)
Tests       260 passed (260)
Duration    8.79s
```
All 260 tests pass. The two console.error lines in test output are expected — from useAuth.test.jsx deliberately testing the outside-provider error.

GAP: No tests cover readInitialAppTab, isValidTab, isAdminRoute, the hashchange useEffect, or signOut side effects. HIGH-1 and HIGH-2 are NOT caught by the test suite.

### Build
```
x Build failed: EACCES permission denied, unlink '/root/PettoFlow/dist/assets/...'
```
Environment issue — the pre-existing dist/ directory is read-only in this sandbox. All 2135 modules transformed successfully before the directory cleanup step failed. No compilation errors from the changed files.

---

## 5. Verdict: Safe to Ship?

NO. Two blocking fixes required.

### Blocking (must fix before ship)

FIX HIGH-1 — Replace localStorage.clear() with surgical removal in AuthContext.jsx:205-206:
```js
// Remove only app-specific auth-adjacent keys
localStorage.removeItem('nexuscrm_active_tenant_id')
localStorage.removeItem('nexus_flags')
// Leave 'pettoflow_theme' — it is user preference, not auth state
// Supabase already removes sb-* keys via signOut({ scope: 'local' })
```

FIX HIGH-2 — Remove or guard the handler() immediate invocation in App.jsx:540:
```js
// Option A: remove immediate call, readInitialAppTab() already handles initial state
useEffect(() => {
  const handler = () => {
    const hash = window.location.hash.slice(1)
    if (hash && isValidTab(hash)) {
      handleTabChange(hash)
    }
  }
  window.addEventListener('hashchange', handler)
  // Do NOT call handler() — avoids ?tab= param override and repeated palette close
  return () => window.removeEventListener('hashchange', handler)
}, [handleTabChange])
```

### Recommended (ship-soon, non-blocking)
- MEDIUM-1: Decide scope intent; use 'global' for full device invalidation or document 'local' as intentional.
- MEDIUM-3: Add isPlatformAdmin guard in renderContent() admin switch cases.
- MEDIUM-2: Move closePalette() to after the nextTab === activeTab guard on line 502.
