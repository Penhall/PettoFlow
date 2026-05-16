# Remediation Plan — NexusCRM Phase 1-5 Audit

**Auditor:** Independent Principal Auditor  
**Date:** 2026-05-16  
**Source phases:** PHASE-01 through PHASE-05 + PHASE-02A  
**Baseline commit:** d21a579 (workspace-core OPTIONS fix)

> **Note:** Intended path is `docs/test-reports/remediation-plan.md`.
> Written to `docs/` due to directory ownership constraints (test-reports/ is root-owned).
> Move with: `mv docs/remediation-plan.md docs/test-reports/remediation-plan.md`

---

## Issue Registry by Severity

### CRITICAL

| ID | Source | Description | Status |
|----|--------|-------------|--------|
| OP-01 | PHASE-01 | `workspace-core` OPTIONS preflight returned `503 BOOT_ERROR`, blocking all CORS preflight requests | ✅ **Fixed** — commit d21a579 |

### HIGH

_None outstanding._

### MEDIUM

| ID | Source | File | Lines | Description |
|----|--------|------|-------|-------------|
| OP-02 | PHASE-01 | `src/context/AuthContext.jsx` | 197–205 | `signOut()` calls `supabase.auth.signOut()` but does **not** clear `nexuscrm_active_tenant_id` from `localStorage`. The stale key persists after logout, so the next login bootstraps the previous tenant before TenantContext resolves the correct one from the server. |
| PH4-01 | PHASE-04 | `src/App.jsx` | 786–1050 | Admin panel routes (`admin-dashboard`, `admin-tenants`, etc.) are rendered inside the same `renderContent()` switch as tenant-scoped views. When bootstrap fails, the workspace error UI can block the content area even though admin panels have no dependency on tenant bootstrap data. |
| PH5-01 | PHASE-05 | `supabase/functions/telegram-webhook/` | — | Telegram bot was **not functionally tested** in any execution environment. All verification was code-only. No test harness or activation runbook exists to validate webhook dispatch, HMAC validation, or action execution without a live token. |

### LOW

| ID | Source | File | Lines | Description |
|----|--------|------|-------|-------------|
| OP-03 | PHASE-01 | `src/App.jsx` | 70–75 | `readInitialAppTab()` defaults to `'tarefas'` for all users. Platform admins with no active tenant (e.g., `penhall@gmail.com`) land on the Tasks view (empty state + "create workspace" prompt), obscuring the GESTÃO SAAS admin panels in the sidebar. |
| TU-02 | PHASE-02 | `src/lib/featureFlags.js` | 19–35 | Five flags in `DEFAULT_FLAGS` have no verified runtime consumption: `onboarding_retry_on_failure`, `diagnostics_panel`, `stale_session_recovery`, `tenant_mismatch_recovery`, `finance_rules_engine`. Dead flags create false confidence during rollout. (Note: PHASE-02 referenced an older flag set — `guided_tour_enabled`, `batch_operations`, `calendar_view`, etc. — those flags no longer exist in `DEFAULT_FLAGS`, confirming a prior refactor removed them without updating the test report.) |
| TU-03 | PHASE-02A | `src/components/shell/SidebarRail.jsx` | 78–130 | Browser automation required `element.click()` via JS console to navigate the sidebar. Code review confirms buttons are proper `<button>` elements with `onClick` handlers, so this may be a CSS hit-area constraint (`pointer-events: none` on icon/label child) or a test-tool artifact. Real-user impact unconfirmed; warrants a manual a11y audit before closing. |
| TU-04 | PHASE-02A | Supabase seed data | — | Sections **Atividades**, **Finanças**, and **Arquivo** have zero seed records in the `Central` tenant. Not a production defect, but creates ambiguity during QA and stakeholder demos. |

---

## Implementation Phases

---

### Phase A — Completed (do not re-open)

**Scope:** workspace-core CORS preflight fix  
**Commit:** d21a579

#### Changes applied

| File | Change |
|------|--------|
| `supabase/functions/workspace-core/index.ts` | Moved `OPTIONS` check to the **first line** of `Deno.serve` handler, before `createRequestContext()` and `attachRequestId()` |
| `supabase/functions/_shared/limits.ts` | Added re-export of `resolveLimitExceededMessage` |

#### Validation (confirmed during testing)
- `OPTIONS /workspace-core/*` → `HTTP 204` with `Access-Control-Allow-Origin: *` ✅
- `GET /workspace-core/bootstrap` → functional ✅
- `POST /workspace-core/tasks` → functional ✅

---

### Phase B — Auth & Session Integrity

**Issues:** OP-02, OP-03  
**Priority:** High  
**Estimated effort:** < 1 day  
**Risk:** Low — isolated to auth flow and initial tab selection

---

#### B1 — Fix signOut to clear active-tenant localStorage (OP-02)

**File:** `src/context/AuthContext.jsx`  
**Lines:** 197–205

**Root cause:** `signOut()` clears the Supabase auth session but leaves `nexuscrm_active_tenant_id` in localStorage. The auth state listener fires before TenantContext can clear its state, so the next login picks up the stale tenant ID from storage.

**Current code:**
```js
async function signOut() {
  if (!supabase) {
    throw getMissingConfigError()
  }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  setMfaChallenge(null)
}
```

**Required change:** Import `setStoredActiveTenantId` from `src/lib/activeTenant.js` and call it with `null` immediately after a successful sign-out:

```js
// Add to imports at top of AuthContext.jsx:
import { setStoredActiveTenantId } from '../lib/activeTenant.js'

async function signOut() {
  if (!supabase) {
    throw getMissingConfigError()
  }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  setStoredActiveTenantId(null)  // clear stale tenant before auth listener fires
  setMfaChallenge(null)
}
```

**Expected outcome:** After clicking "Sair", `localStorage['nexuscrm_active_tenant_id']` is absent. The next login resolves the tenant freshly from the server via TenantContext.

---

#### B2 — Default to admin-dashboard for platform admins without a tenant (OP-03)

**File:** `src/App.jsx`  
**Lines:** 70–75 (`readInitialAppTab`), ~113–114 (`isPlatformAdmin`, `activeTenantId` declarations)

**Root cause:** `readInitialAppTab()` runs synchronously before React renders, before auth resolves, so it cannot know `isPlatformAdmin`. It always returns `'tarefas'`.

**Required change:** Add a one-time effect after `isPlatformAdmin` and `activeTenantId` are available:

```js
// Place after the isPlatformAdmin / activeTenantId declarations (~line 114)
useEffect(() => {
  if (isPlatformAdmin && !activeTenantId && activeTab === 'tarefas') {
    setActiveTab('admin-dashboard')
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isPlatformAdmin, activeTenantId])
```

If the tab change causes a visible flash, switch to `useLayoutEffect`.

**Expected outcome:** `penhall@gmail.com` (and any future admin-only user) lands on Admin Dashboard on first render instead of the empty Tasks view.

---

#### Phase B Validation Steps
1. Log in as `penhall@gmail.com` → first tab rendered is `admin-dashboard` (no flash of Tasks view).
2. Click "Sair" → DevTools → Application → Local Storage → `nexuscrm_active_tenant_id` key is absent.
3. Log back in as `tester@nexuscrm.com` → tenant `Central` resolves fresh (no stale collision).
4. Run `src/components/auth/ProtectedRoute.test.jsx` — all tests pass.

---

### Phase C — Admin Panel Resilience

**Issue:** PH4-01  
**Priority:** Medium  
**Estimated effort:** 1–2 days  
**Risk:** Medium — touches the main render path; test in isolation

---

#### C1 — Decouple admin views from tenant bootstrap state

**File:** `src/App.jsx`  
**Lines:** 786–1050 (`renderContent()`)

**Root cause:** `renderContent()` has admin tab cases at the bottom of a single `switch`. Any upstream render interruption (workspace error UI, bootstrap guard) can prevent them from being reached.  Admin views have zero dependency on `activeTenantId` or `bootstrapRead`.

**Required change:** Hoist admin tab cases above the tenant-dependent switch:

```js
function renderContent() {
  // Admin views: no dependency on tenant bootstrap — render first
  switch (activeTab) {
    case 'admin-dashboard':   return <AdminDashboard />
    case 'admin-tenants':     return <TenantsPage />
    case 'admin-audit':       return <AuditPage />
    case 'admin-plans':       return <PlansPage />
    case 'admin-diagnostics': return <DiagnosticsPanel />
  }

  // Everything below requires an active tenant workspace
  switch (activeTab) {
    case 'dashboard': ...
    // ... existing cases unchanged (remove the duplicate admin-* cases from here)
    default: return null
  }
}
```

Remove the duplicate `admin-*` cases at lines 1043–1047.

**Expected outcome:** When `bootstrapError` is non-null, platform admins can navigate to and use all five admin panels without being blocked by workspace error state.

---

#### Phase C Validation Steps
1. DevTools → Network → block `workspace-core` (set offline or intercept to 503).
2. Log in as `penhall@gmail.com` → workspace error UI appears for tenant-scoped tabs ✅.
3. Click `admin-dashboard` in sidebar → renders successfully, not blocked ✅.
4. Click `admin-tenants`, `admin-audit`, `admin-plans`, `admin-diagnostics` → each renders ✅.
5. Restore network → click "Tentar novamente" → workspace bootstrap recovers for tenant views ✅.

---

### Phase D — Feature Flags Audit & Telegram Runbook

**Issues:** TU-02, PH5-01  
**Priority:** Medium  
**Estimated effort:** 2–3 days  
**Risk:** Low

---

#### D1 — Audit and wire or remove dead feature flags (TU-02)

**File:** `src/lib/featureFlags.js` (lines 19–35) + consuming components

For each unverified flag, either wire it to a component guard or remove it from `DEFAULT_FLAGS`:

| Flag | Default | Required Action |
|------|---------|--------------------|
| `onboarding_retry_on_failure` | `true` | Verify in `src/hooks/useOnboarding.js` — add `isEnabled('onboarding_retry_on_failure')` guard on retry logic, or remove the flag |
| `diagnostics_panel` | `false` | `src/lib/diagnostics.js` has its own private `isEnabled()` unrelated to `featureFlags.js`. Unify them (make `diagnostics.js` call `isEnabled('diagnostics_panel')`) or remove the flag from `DEFAULT_FLAGS` |
| `stale_session_recovery` | `true` | Locate or implement stale-session recovery UI; add `isEnabled('stale_session_recovery')` guard or remove |
| `tenant_mismatch_recovery` | `true` | Locate or implement tenant-mismatch recovery UI; add `isEnabled('tenant_mismatch_recovery')` guard or remove |
| `finance_rules_engine` | `true` | Wire to Finance rules tab visibility in `src/components/Finance/` or remove if the rules engine is not yet shipped |

**Expected outcome:** Every key in `DEFAULT_FLAGS` has at least one `isEnabled(key)` call in a component or hook. Zero dead flags remain.

---

#### D2 — Telegram activation runbook (PH5-01)

**File to create:** `supabase/functions/telegram-webhook/README.md`

PHASE-05 already documents the required env vars and the `setWebhook` curl command. Consolidate into a runbook:

1. Create bot via BotFather → obtain `TELEGRAM_BOT_TOKEN`
2. Set Supabase secrets: `TELEGRAM_BOT_TOKEN`, `BOT_CONFIG_SECRET`, `PUBLIC_URL`
3. Register webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     --data "url=https://qzljsendvthfetrntwab.supabase.co/functions/v1/telegram-webhook"
   ```
4. Link tenant to hash via admin panel
5. Send `/start` → verify bot responds and Supabase function logs show the dispatch
6. Send a task-creation command → verify record appears in `tasks` table

**Optional (preferred):** Add `supabase/functions/telegram-webhook/test/integration.test.ts` that calls the handler directly with a mock payload signed with a known test secret. Assert the correct Telegram reply and a database write, without a live token.

**Expected outcome:** A developer can validate Telegram end-to-end in under 30 minutes using the runbook, independent of a production environment.

---

#### Phase D Validation Steps
1. Run:
   ```bash
   grep -r "isEnabled" src/ --include="*.js" --include="*.jsx" | grep -v "featureFlags.js"
   ```
   Every key in `DEFAULT_FLAGS` must appear in the output.
2. For D2 integration test: `deno test supabase/functions/telegram-webhook/` — all tests pass.
3. For D2 runbook: follow the README guide in staging; bot responds to `/start` within 60 seconds.

---

### Phase E — Accessibility & Demo Data

**Issues:** TU-03, TU-04  
**Priority:** Low  
**Estimated effort:** < 1 day each  
**Risk:** Low

---

#### E1 — Sidebar button hit-area a11y audit (TU-03)

**File:** `src/components/shell/SidebarRail.jsx` (lines 78–130)

Code review confirms buttons are proper `<button>` elements with `onClick` handlers. The automation workaround (requiring `element.click()` in the console) may indicate a CSS constraint, not a structural bug.

**Required actions (in order):**
1. Open DevTools → Elements → inspect each sidebar `<button>` and its icon/label children.
2. Verify no child has `pointer-events: none`.
3. Verify no absolutely-positioned sibling overlaps the button area.
4. Test keyboard navigation: `Tab` to reach each button, `Enter`/`Space` to activate.
5. Verify `aria-current="page"` (or equivalent) is present on the active item.

Fix only what the audit confirms is broken. No structural refactor unless a concrete hit-area problem is found.

**Expected outcome:** Sidebar buttons respond to mouse click and keyboard activation. Screen reader announces button role and current-page state.

---

#### E2 — Seed data for QA and demo tenants (TU-04)

**Files:** `supabase/seed.sql` or a new file in `supabase/migrations/`

Add at minimum 2–3 sample records for the `Central` tenant:
- `activities`: 2 follow-up calls (e.g., by Ana Oliveira and Rafael Lima)
- `accounts` + `transactions`: 1 receivable (R$1.500), 1 expense (R$300)
- Archived task: 1 completed/archived task so Arquivo is non-empty

Scope this to a seed-only file — not a regular migration — to prevent accidental inclusion in production deployments.

**Expected outcome:** All 6 frontend sections show non-empty state for `Central` without manual data entry, enabling a full end-to-end UI walkthrough.

---

#### Phase E Validation Steps
1. Apply seed to local/dev Supabase instance.
2. Log in as `tester@nexuscrm.com` (tenant Central).
3. Atividades → at least 1 activity row visible ✅.
4. Finanças → non-zero balance, at least 1 transaction ✅.
5. Arquivo → at least 1 archived task ✅.
6. Keyboard-navigate sidebar → every button reachable and activatable via `Tab` + `Enter` ✅.

---

## Consolidated Priority Table

| Phase | Issues | Priority | Effort | Risk | Status |
|-------|--------|----------|--------|------|--------|
| A | OP-01 | — | — | — | ✅ Completed (d21a579) |
| B | OP-02, OP-03 | **High** | < 1 day | Low | Pending |
| C | PH4-01 | Medium | 1–2 days | Medium | Pending |
| D | TU-02, PH5-01 | Medium | 2–3 days | Low | Pending |
| E | TU-03, TU-04 | Low | < 1 day each | Low | Pending |

---

## Cross-Cutting Notes

**1. Session clearing scope (Phase B1):** Evaluate whether `nexus_flags` localStorage overrides should also be cleared on sign-out. If flag overrides are session-scoped (not account-scoped), add `clearFlagOverrides()` to `signOut()` in `AuthContext.jsx` alongside `setStoredActiveTenantId(null)`.

**2. Admin redirect flash (Phase B2):** If `useEffect` fires after the first paint, there will be a brief flash of the Tasks view before the redirect to `admin-dashboard`. Prefer `useLayoutEffect` to suppress it. Benchmark against hydration warnings if SSR is ever added.

**3. Telegram runbook (Phase D2):** The activation steps are documented in PHASE-05 but scattered. Move them into `supabase/functions/telegram-webhook/README.md` immediately — this is a one-hour task and is the minimum viable deliverable for PH5-01, independent of whether an integration test is built.

**4. Feature flag discipline (TU-02):** PHASE-02 referenced flags (`guided_tour_enabled`, `batch_operations`, `calendar_view`, etc.) that no longer exist in `featureFlags.js`. A prior refactor removed them without updating the test report. Establish a convention: any PR that removes a flag must also grep for and remove all `isEnabled('flag_name')` call sites. Consider a unit test that asserts the set of keys in `DEFAULT_FLAGS` equals the set of flag names passed to `isEnabled()` across the source tree.
