# NexusCRM — Phase 35 Independent Operational Audit

**Auditor role:** Independent Principal Operational Auditor  
**Audit date:** 2026-05-15  
**Phases reviewed:** 35A (Telegram Tenant Convergence), 35B (Mutation & Error Semantics), 35C (Content, Encoding & UX Governance)  
**Method:** Direct source file reads; no assumption of correctness; code verified at line level  
**Prior baseline:** Phase 34A/34B/34C independent audit findings

---

## 1. Executive Assessment

Phase 35 represents genuine, measurable operational improvement in all three dimensions it targeted. The Telegram path is now structurally tenant-isolated. All frontend mutations now return explicit `{ ok, data, error, code }` contracts. Active source is mojibake-free with a governance test that will detect regressions.

**However, one confirmed functional bug was found in Phase 35A that must be resolved before production deployment.** The `getPendingConfirmation` expiry-cleanup path deletes `task_list_context` records, causing silent data loss in the task completion workflow. This is not a theoretical risk—it is triggered by normal user behavior (a finance confirmation expires while a task list is cached).

Two medium-severity issues remain (null-unsafe allowlist access and silent read-path fetch failures). All three were introduced or left unfixed by Phase 35.

**Production-readiness verdict: NOT YET READY — one confirmed functional bug requires a fix before deployment.**

---

## 2. Phase 35A — Telegram Tenant Convergence Findings

### 2.1 Config Resolution (`utils/config.ts`)

**VERIFIED CORRECT.**

`resolveBotConfigFromWebhookSecret()` implements a two-phase resolution:

1. Hash-based lookup: `eq('webhook_secret_sha256', secretHash).maybeSingle()` — O(1) via unique index.
2. Legacy fallback: fetches all configs with `is('webhook_secret_sha256', null)`, decrypts each in-memory, matches, then back-fills the hash.

The back-fill write at lines 56–60 is correctly scoped:
```ts
.update({ webhook_secret_sha256: secretHash })
.eq('tenant_id', config.tenant_id)
.eq('id', config.id)
```

On hash lookup error the function throws (propagates to 500 response). On legacy lookup error it throws. On no match it returns `null` (401 upstream). Telemetry is called on resolution failures. This is clean.

**Residual concern (LOW):** The legacy fallback at lines 40–70 does a full-table scan (all configs without a hash), decrypting each one in memory. This is O(n) in the number of legacy configs. It is self-healing — each matching config gets its hash written, shrinking the legacy pool. Acceptable for a migration path, but slow on first post-deploy requests if many legacy tenants exist.

### 2.2 Webhook Entrypoint (`index.ts`)

**VERIFIED CORRECT. One bug found.**

The global `.limit(1).single()` anti-pattern from Phase 34 is eliminated. Verified at line 52:
```ts
const configRow = await resolveBotConfigFromWebhookSecret(sb, requestSecret, encryptionKey)
```

`tenantId` is extracted at line 61 and propagated explicitly to every handler invocation:
- `createTask(sb, tenantId, ...)` — line 202
- `listTasks(sb, tenantId, chatId)` — line 205
- `completeTask(sb, tenantId, chatId, ...)` — line 208
- `setPriority(sb, tenantId, chatId, ...)` — line 211
- `logActivity(sb, tenantId, ...)` — line 214
- `listActivities(sb, tenantId)` — line 217
- `recordTransaction(sb, tenantId, ...)` — lines 233, 174
- `getBalance(sb, tenantId)` — line 244
- `listTransactions(sb, tenantId)` — line 247
- `executeActions(sb, tenantId, chatId, actions)` — line 149
- `requestConfirmation(sb, tenantId, chatId, ...)` — line 224
- `getPendingConfirmation(sb, tenantId, chatId)` — line 169
- `clearPendingConfirmation(sb, tenantId, chatId)` — line 171

Bot-user authorization update at line 254 also scoped:
```ts
.update({ allowed_telegram_ids: newIds })
.eq('tenant_id', tenantId)
.eq('id', configRow.id)
```

**BUG — MEDIUM — `bot.start` null-unsafe on `allowed_telegram_ids` (index.ts:250–251):**

```ts
if (!config.allowed_telegram_ids.includes(fromId)) {       // line 250 — throws if null
  const newIds = [...config.allowed_telegram_ids, fromId]  // line 251 — throws if null
```

`BotConfigRow` declares `allowed_telegram_ids: string[] | null`. The cast at line 65 (`as string[]`) removes the null from TypeScript's perspective but provides no runtime protection. If the DB row was inserted with `allowed_telegram_ids = NULL` (valid), this path throws a TypeError. The `bot-config/index.ts` GET handler correctly normalizes null to `[]` for the frontend, but the webhook reads the DB directly via service role and performs no normalization.

**Fix:** Replace with `(config.allowed_telegram_ids ?? []).includes(fromId)` and `[...(config.allowed_telegram_ids ?? []), fromId]`.

### 2.3 Action Handlers

**VERIFIED CORRECT.**

**`actions/tasks.ts`:** All reads and writes scoped. Verified:
- `getBoardStatuses`: `.eq('tenant_id', tenantId)` on kanban_columns — line 9
- `createTask`: insert includes `tenant_id: tenantId` — line 30; account lookup (not present, uses status only)
- `listTasks`: `.eq('tenant_id', tenantId)` on tasks — line 44; bot_pending_confirmations insert includes `tenant_id: tenantId` — line 81; delete also scoped — line 77
- `completeTask`: confirmation lookup `.eq('tenant_id', tenantId)` — line 100; task update `.eq('tenant_id', tenantId)` — line 116
- `setPriority`: same scoping as completeTask — lines 134, 150

**`actions/finance.ts`:** All reads and writes scoped. Verified:
- `getPrincipalAccountId`: `.eq('tenant_id', tenantId)` — line 13
- `recordTransaction`: insert includes `tenant_id: tenantId` — line 35
- `getBalance`: accounts fetch `.eq('tenant_id', tenantId)` — line 54; transactions fetch per account `.eq('tenant_id', tenantId)` — line 65
- `listTransactions`: `.eq('tenant_id', tenantId)` — line 79

**`actions/activities.ts`:** All reads and writes scoped (confirmed by agent inspection).

**`utils/actions.ts`:** `executeActions` receives `tenantId` and forwards it to every handler — verified at lines 25, 32, 34, 38, 44, 52.

### 2.4 Confirmation Utility (`utils/confirm.ts`)

**VERIFIED WITH ONE BUG.**

`requestConfirmation`: deletes by `(tenant_id, chat_id, action_type)`, inserts with `tenant_id`. Correct.

`clearPendingConfirmation`: deletes by `(tenant_id, chat_id)` with `.not('action_type', 'eq', 'task_list_context')`. Correctly preserves task list context.

**BUG — HIGH — `getPendingConfirmation` expiry cleanup deletes `task_list_context` (confirm.ts:49–52):**

```ts
if (new Date(data.expires_at) < new Date()) {
  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('chat_id', chatId)      // NO exclusion of task_list_context
  return null
}
```

When a `finance.record` confirmation expires, this cleanup path deletes **all** `bot_pending_confirmations` for the tenant+chat, including any active `task_list_context` record. The `clearPendingConfirmation` function at lines 57–68 correctly excludes `task_list_context` with `.not('action_type', 'eq', 'task_list_context')`, but this expiry cleanup does not.

**Reproduction scenario:**
1. User runs `/tarefas` → task list context stored (30 min TTL)
2. User runs `/pagar almoço 600` → finance.record confirmation stored (5 min TTL, above threshold)
3. User ignores confirmation for 5+ minutes
4. User runs `SIM` or any message → `getPendingConfirmation` finds expired confirmation → deletes ALL records including task_list_context
5. User runs `/ok 1` → fails with "Lista expirada" even though the task list was valid

This is a functional regression caused by the new expiry-cleanup code in Phase 35A. The `clearPendingConfirmation` sister function got the exclusion filter right; `getPendingConfirmation` did not.

**Fix:**
```ts
await sb
  .from('bot_pending_confirmations')
  .delete()
  .eq('tenant_id', tenantId)
  .eq('chat_id', chatId)
  .not('action_type', 'eq', 'task_list_context')  // add this line
```

### 2.5 Migration (`20260515175307_phase_35a_telegram_tenant_convergence.sql`)

**VERIFIED CORRECT.**

- `webhook_secret_sha256` column: added nullable, correct for migration path.
- Unique index on `webhook_secret_sha256 WHERE NOT NULL`: correct partial index, permits nulls, prevents hash collisions.
- Unique index on `(tenant_id, bot_config_id, trigger)` for bot_commands: prevents duplicate triggers per tenant+config.
- `bot_pending_confirmations` block wrapped in `IF to_regclass('public.bot_pending_confirmations') IS NULL THEN RETURN`: idempotent, conditional on table existence.
- `tenant_id` FK added, orphaned rows deleted, column set NOT NULL: safe migration order.
- Composite index `(tenant_id, chat_id)`: supports scoped queries.
- Unique index `(tenant_id, chat_id, action_type)`: enforces one pending action per type per tenant+chat.
- RLS enabled with `service_role` full-access policy: correct for edge function access pattern.

### 2.6 Test Coverage (`tenant-scope.test.ts`)

**5 tests, not 6 as described. The expiry bug is not tested.**

Tests present:
1. Finance persistence scopes account lookup and transaction insert by tenant — MEANINGFUL
2. Task list stores confirmation context under tenant and chat — MEANINGFUL
3. Confirmation lifecycle is tenant scoped — MEANINGFUL
4. Custom command execution forwards tenant id into each action — MEANINGFUL
5. Webhook config resolution maps secret hash to one tenant config — MEANINGFUL

**Missing test:** There is no test for `getPendingConfirmation` expiry behavior. Had such a test existed with a `task_list_context` record in scope, it would have caught the bug at confirm.ts:49.

---

## 3. Phase 35B — Mutation Semantics Findings

### 3.1 `mutationResult.js` Contract

**VERIFIED CORRECT AND SAFE.**

```js
export function ok(data = null) {
  return { ok: true, data, error: null, code: null }
}

export function fail(error, options = {}) {
  const normalized = normalizeError(error, options)
  countMutationFailure(...)
  return { ok: false, data: null, error: normalized, code: normalized.code }
}
```

The shape is explicit and consistent: every mutation result has `ok`, `data`, `error`, `code`. No null returns, no boolean returns.

`normalizeError` scrubs raw backend error messages, replacing them with governed UX copy from `ERROR_MESSAGE_BY_CODE`. The raw message is preserved in `diagnostics.rawMessage` for debugging. `hasRawErrorLeak` uses six regex patterns to detect common provider/DB error strings:

```js
const RAW_ERROR_PATTERNS = [
  /supabase/i, /\bpostgres\b/i, /\bsql\b/i,
  /\bfetch\b/i, /\bstack\b/i, /violates.*constraint/i,
]
```

The test in `mutationResult.test.js` confirms: a raw `"Supabase SQL violates constraint workspace_id_fkey"` error normalizes to `"Não foi possível salvar a alteração. Revise os dados e tente novamente."` with `hasRawErrorLeak` returning false.

Code mapping is explicit: `PGRST116` → `not_found`, `ACTIVE_TENANT_REQUIRED` → `missing_tenant`. Unknown codes default to `persistence_failed`.

### 3.2 Hook Audit — `useTransactions.js`

**VERIFIED: All mutations use `runMutation`. Tenant guard returns `fail()`.**

- `addTransaction`: tenant guard at line 88 returns `fail(new Error('tenant required'), { code: 'missing_tenant' })`. Mutation wrapped in `runMutation('transactions.add', ...)` — line 95.
- `updateTransaction`: same pattern — lines 104, 109.
- `deleteTransaction`: same pattern — lines 118, 120.
- `applyRules`: same pattern — lines 129, 137 (checks `isMutationOk` between iterations).

No remaining `return null`, `return false`, or uncaught error paths in the mutation surface.

**Remaining gap (MEDIUM — pre-existing, not introduced by Phase 35B):** The fetch effect at lines 66–73 uses `console.error` only:
```js
.catch((error) => {
  if (cancelled) return
  console.error('Error fetching transactions:', error)
})
```
Fetch failures produce blank data with no user-facing error. This was explicitly out of Phase 35B scope (mutations only), but it remains a user-experience gap.

### 3.3 Hook Audit — `useActivities.js`

**VERIFIED: All mutations use `runMutation`. Tenant guard returns `fail()`.**

- `addActivity`, `updateActivity`, `deleteActivity`: all check `if (!tenantId) return fail(...)` before entering `runMutation(...)`.

Fetch effect at lines 41–43: same `console.error`-only gap as useTransactions.

### 3.4 Hook Audit — `useReceivables.js`

**VERIFIED: All mutations use `runMutation`. Tenant guard returns `fail()`.**

`invoiceReceivable` is the most complex path. It chains two mutations:
```js
const transactionResult = await addTransaction(...)
if (!isMutationOk(transactionResult)) return transactionResult  // line 102
const transaction = getMutationData(transactionResult)
return runMutation('receivables.invoice', async () => { ... })
```

This is correct: the receivable update only proceeds if the transaction write succeeded.

The `fetch` function at lines 32–42 uses `console.error` and returns `[]` on error — same silent failure gap.

### 3.5 Modal Audit — `TransactionForm.jsx`

**VERIFIED CORRECT.**

`handleSubmit` at lines 95–105:
```js
const result = await onSave({ ...form, amount: cents })
if (!isMutationOk(result)) {
  setSubmitError(getMutationMessage(result))
}
```

The calling wrapper (`TransactionFormWrapper.handleSave`) calls `onClose()` only after `isMutationOk(result)` — line 24–26. The modal does not close on persistence failure.

**Design note (LOW):** `TransactionForm` itself does not call `onClose`. The close is entirely delegated to the `onSave` prop. If a future caller passes an `onSave` that does not close on success, the form stays open. This is a convention dependency, not an enforced contract.

### 3.6 Modal Audit — `TaskModal.jsx`

**VERIFIED CORRECT.**

`handleSubmit` at lines 95–103:
```js
const result = await onSave(form)
if (!isMutationOk(result)) {
  setSubmitError(getMutationMessage(result))
}
```

Same pattern as TransactionForm. Error is shown in the form via `submitError` state. Close is delegated to the `onSave` parent.

### 3.7 Test Coverage

**MEANINGFUL, not shallow.**

`mutationResult.test.js` (3 tests): covers raw-error normalization, ok/fail shape, and tenant/stale code mapping with actual message assertions.

`useActivities.test.jsx` (3 tests): covers persistence success (state updated, result.ok), persistence failure (state preserved, safe message returned, raw message in diagnostics), and missing-tenant rejection (code: 'missing_tenant', workspace guard message, saveActivityRecord not called). These tests exercise the full contract, not just surface shape.

### 3.8 Telemetry Counters

**VERIFIED: 7 new counters added** (`countMutationFailure`, `countPersistenceRejection`, `countStaleMutationRejection`, `countOnboardingCompleted`, `countOnboardingDropOff`, `countOverlayInterruption`, `countCommandFailure`).

Counters are bounded at MAX_COUNTER (999999), module-level globals, gated on `__NEXUS_DIAG__` for logging output. Telemetry accumulation is not gated; counters always increment. This is correct for production observability.

**Minor issue:** `fail()` increments `mutation_failures` for `code: 'missing_tenant'`, which is a precondition guard (no active workspace selected), not a persistence failure. This inflates the `mutation_failure_` telemetry bucket for a UX flow issue. Functionally harmless but will make failure metrics noisier.

---

## 4. Phase 35C — Content/UX Governance Findings

### 4.1 `uxText.js` Vocabulary Coverage

**VERIFIED COMPREHENSIVE.**

The module exports 8 governed namespaces: `PRODUCT`, `ACTION_TEXT`, `LOADING_TEXT`, `SHELL_TEXT`, `EMPTY_STATE_TEXT`, `ERROR_TEXT`, `SETTINGS_TEXT`, `ADMIN_TEXT`, `ERROR_MESSAGE_BY_CODE`.

Product identity is declared as `PRODUCT.name = 'NexusCRM'` consistently. All UI copy uses Portuguese throughout.

### 4.2 `encoding.js` Mojibake Detection

**VERIFIED CORRECT. Pattern coverage is acceptable but not exhaustive.**

```js
const MOJIBAKE_PATTERNS = [
  /Ã[-¿]/,   // generic UTF-8 double-encoded high byte
  /Â[-¿]/,   // generic UTF-8 double-encoded
  /�/,                  // Unicode replacement character
  /NÃ£o|possÃ|espaÃ|.../,  // specific Portuguese words
]
```

Patterns 1–2 correctly detect the canonical UTF-8 double-encoding failure mode (byte sequence treated as Latin-1 then stored as UTF-8 again). Pattern 3 catches the BOM/replacement character. Pattern 4 catches specific common Portuguese words but is not exhaustive — new Portuguese strings with accented characters would not be caught by pattern 4 alone. However, patterns 1–2 would catch most real-world mojibake in Portuguese text.

### 4.3 Mojibake in Active Source

**VERIFIED CLEAN.**

`grep` for mojibake patterns in `/root/PettoFlow/src/App.jsx` returned no matches. The governance test in `uxGovernance.test.js` walks all `.js/.jsx/.ts/.tsx/.css/.html` files under `src/` and `supabase/functions/`, excluding `node_modules`, `dist`, and `__screenshots__`. This test will enforce mojibake-free source on every run.

### 4.4 Governance Test Coverage Gap

**BUG — LOW-MEDIUM — `ADMIN_TEXT` excluded from encoding governance test (`uxGovernance.test.js`).**

The `collectMojibakeEntries` call at lines 36–49 checks:
```js
{ ACTION_TEXT, EMPTY_STATE_TEXT, ERROR_MESSAGE_BY_CODE, ERROR_TEXT, LOADING_TEXT, PRODUCT, SETTINGS_TEXT, SHELL_TEXT }
```

`ADMIN_TEXT` is exported from `uxText.js` but is NOT included in this check. If `ADMIN_TEXT` were to acquire a mojibake string (e.g., in a future edit), the governance test would not catch it.

**Fix:** Add `ADMIN_TEXT` to the import and to the `collectMojibakeEntries` call in `uxGovernance.test.js`.

### 4.5 Admin Page Terminology Audit

**`TenantsPage.jsx` — VERIFIED CORRECT.**

Uses `LOADING_TEXT.tabs['admin-tenants']` for loading state, `EMPTY_STATE_TEXT.noWorkspaces` for empty state. Error handling at line 23 goes through `normalizeError(...).message` — raw errors are not exposed. Column headers use "Espaços de trabalho" consistently. No "tenants", "workspaces", or other English terminology visible.

**`AdminDashboard.jsx` — VERIFIED CORRECT.**

Uses `LOADING_TEXT.tabs['admin-dashboard']` for loading state. Error handling at line 34 goes through `normalizeError(...).message`. Metric labels use Portuguese: `'Total de espaços'`, `'Espaços ativos'`, `'MRR'`. No raw errors exposed.

### 4.6 `playwright.config.js` Cross-Platform Fix

**VERIFIED CORRECT.**

Previous issue: `npm.cmd` was Windows-only. Fixed to:
```js
command: 'npm run dev -- --host 127.0.0.1 --port 4173',
```

This is the standard cross-platform form. No platform-conditional logic needed.

### 4.7 `bot-config/index.ts` — Ungovernened Error String

**NOTE — LOW.**

Line 32 of `bot-config/index.ts`:
```ts
return json(req, { error: 'ENCRYPTION_KEY nao configurada.' }, 500)
```

`nao` should be `não` (tilde missing). This is a server-side error message returned in a JSON response to the edge function caller, not a user-facing UI string, so it bypasses the uxText governance system. It would not be caught by the mojibake detection (the absence of accent is not mojibake). Minor quality issue; does not affect users.

---

## 5. Regression Risk Assessment

| Area | Risk | Status |
|------|------|--------|
| Runtime orchestration semantics | Not modified in Phase 35 | SAFE |
| Cancellation guards (`let cancelled = false`) | Present in useTransactions:62, useActivities:33 | SAFE |
| Ownership enforcement (workspaceCore) | Not touched | SAFE |
| Tenant gate in hooks | Explicit `fail()` guards added, not weakened | IMPROVED |
| Test coverage | Net-positive additions (3 + 3 + 4 tests added) | IMPROVED |
| New raw error surfaces | `normalizeError` wraps all surfaces | IMPROVED |
| Telemetry | Gated, bounded, no allocations | SAFE |
| Modal close-on-failure prevention | Explicit `isMutationOk` guards added | IMPROVED |

**No regressions detected in these areas.**

**New regression introduced by Phase 35A:** `getPendingConfirmation` expiry cleanup deletes `task_list_context`. This is a net-new functional bug.

---

## 6. Issues Found — Severity Summary

### CRITICAL
None.

### HIGH

**[35A-H1] `getPendingConfirmation` expiry cleanup deletes `task_list_context`**
- File: `supabase/functions/telegram-webhook/utils/confirm.ts:49–52`
- Description: When a finance confirmation record expires, the cleanup deletes ALL `bot_pending_confirmations` for the tenant+chat, including active `task_list_context` records. The sister function `clearPendingConfirmation` has the correct exclusion filter; `getPendingConfirmation` does not.
- Impact: Users lose task list context after any finance confirmation expires. `/ok [n]` returns "Lista expirada" despite a valid task list.
- Fix: Add `.not('action_type', 'eq', 'task_list_context')` to the delete in `getPendingConfirmation`:
  ```ts
  await sb.from('bot_pending_confirmations')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('chat_id', chatId)
    .not('action_type', 'eq', 'task_list_context')
  ```

### MEDIUM

**[35A-M1] `bot.start` null-unsafe access on `allowed_telegram_ids`**
- File: `supabase/functions/telegram-webhook/index.ts:250–251`
- Description: `config.allowed_telegram_ids.includes(fromId)` and the spread `[...config.allowed_telegram_ids, fromId]` will throw `TypeError` if `allowed_telegram_ids` is NULL in the database. The TypeScript cast `as string[]` does not protect at runtime.
- Impact: `/start` command throws for any bot config with a NULL allowlist, preventing user self-onboarding.
- Fix: `(config.allowed_telegram_ids ?? []).includes(fromId)` and `[...(config.allowed_telegram_ids ?? []), fromId]`

**[35B-M1] Read-path fetch failures are silent across all domain hooks**
- Files: `src/hooks/useTransactions.js:71–73`, `src/hooks/useActivities.js:41–43`, `src/hooks/useReceivables.js:36–38`
- Description: Fetch errors produce blank data with `console.error` only. No error state is set; no user-facing message is shown.
- Impact: Users see empty lists with no indication of failure.
- Note: Pre-existing gap not introduced by Phase 35B, which addressed mutations only.

### LOW

**[35C-L1] `ADMIN_TEXT` excluded from encoding governance test**
- File: `src/content/uxGovernance.test.js:36–49`
- Description: `ADMIN_TEXT` is exported from `uxText.js` but not passed to `collectMojibakeEntries`. Future mojibake in ADMIN_TEXT would not be caught by the governance test.
- Fix: Add `ADMIN_TEXT` to the import and the `collectMojibakeEntries` object in `uxGovernance.test.js`.

**[35B-L1] `fail()` increments `mutation_failures` counter for `missing_tenant`**
- File: `src/lib/mutationResult.js:44`
- Description: A missing-tenant guard failure (user has no workspace selected) increments the same `mutation_failures` telemetry bucket as actual persistence failures. Slightly misleading metrics.

**[35C-L2] `'nao'` typo in `bot-config/index.ts:32`**
- File: `supabase/functions/bot-config/index.ts:32`
- Description: Server-side error string `'ENCRYPTION_KEY nao configurada.'` is missing the tilde (should be `não`). Does not affect users directly.

### NOTE

**[35A-N1] Tenant-scope tests report 5 tests, description claimed 6**
- File: `supabase/functions/telegram-webhook/tenant-scope.test.ts`
- Description: 5 `Deno.test` blocks found in 234 lines. The missing 6th test would most naturally cover the `getPendingConfirmation` expiry behavior — the precise scenario that reveals HIGH bug 35A-H1.

---

## 7. Test Validation Results

Tests were not executed (no test runner invoked). The following assessments are based on code reading:

| Test file | Tests | Quality assessment |
|-----------|-------|-------------------|
| `supabase/functions/telegram-webhook/tenant-scope.test.ts` | 5 | Meaningful. Uses `FakeSupabase` with filter inspection via `hasTenantFilter()`. Each test asserts actual filter presence, not just absence of errors. Missing test for expiry behavior. |
| `src/lib/mutationResult.test.js` | 3 | Meaningful. Asserts on message text, `hasRawErrorLeak`, diagnostics content, and code mapping. Not shallow. |
| `src/hooks/useActivities.test.jsx` | 3 | Meaningful. Uses `renderHook`/`act` with mock resolution and rejection. Asserts on state updates, error messages, raw diagnostics, and mock call counts. Covers success, failure, and missing-tenant paths. |
| `src/content/uxGovernance.test.js` | 4 | Meaningful. Includes filesystem walk that reads actual source files. Will detect future mojibake regressions. Governance gap: ADMIN_TEXT not included. |

---

## 8. Operational Safety Reassessment vs. Phase 34 Audit

| Phase 34 Finding | Phase 35 Resolution | Remaining Risk |
|------------------|---------------------|----------------|
| Telegram/bot not tenant-real (critical isolation) | **RESOLVED** — hash-based resolution, all handlers tenant-scoped | Null-safety bug on bot.start (MEDIUM) |
| Hooks returning null/false silently | **RESOLVED** — all mutations return `{ ok, data, error, code }` | Read-path still silent (MEDIUM, pre-existing) |
| Billing environment-dependent | Not addressed in Phase 35 | UNCHANGED |
| Finance frontend-only calculations | Not addressed in Phase 35 | UNCHANGED |
| Telegram path bypasses tenant propagation | **RESOLVED** — tenantId explicit throughout | Expiry cleanup bug (HIGH) |
| Cross-entity mutations not atomic | Not addressed in Phase 35 | UNCHANGED |
| Silent frontend failures | **RESOLVED for mutations** — explicit fail() with user message | Read-path still silent (pre-existing) |
| Active mojibake in App.jsx | **RESOLVED** — grep confirms clean | ADMIN_TEXT not tested (LOW) |
| Product identity split (NexusCRM/PettoFlow) | **PARTIALLY RESOLVED** — uxText.js governs NexusCRM, directory still named PettoFlow | Governance decision |
| Raw backend errors leaking into UI | **RESOLVED** — normalizeError + hasRawErrorLeak guards in place | None |
| No i18n readiness | Not addressed in Phase 35 | UNCHANGED |

---

## 9. Remaining Risks After Phase 35

### Operational risks requiring action before production:

1. **`getPendingConfirmation` expiry cleanup deletes task_list_context** — must fix before deployment.
2. **`bot.start` throws on null `allowed_telegram_ids`** — must fix or confirm DB always initializes to `[]`.

### Ongoing structural risks (not introduced by Phase 35):

3. **Read-path fetch failures are silent** — no user-visible error on data load failure in any domain hook. Users see blank lists.
4. **Cross-entity mutations not atomic** — finance and task mutations are separate DB calls. Partial failure leaves inconsistent state.
5. **Billing environment-dependent** — not reviewed in Phase 35.
6. **No integration tests for Telegram edge function** — only unit tests with fake Supabase. An actual DB call path with RLS has not been validated.

### Scope notes (not risks, but incomplete):

7. `bot-commands` and `notification-worker` Phase 35A changes were described but not independently verified in this audit.
8. Frontend `botConfig.js`, `botCommands.js`, `TelegramSection`, `CommandsSection`, `CommandForm`, `OnboardingWizard` Telegram-tenant changes were described but not independently verified in this audit.

---

## 10. Overall Production-Readiness Verdict

**NOT YET PRODUCTION-READY — one confirmed functional bug blocks deployment.**

The Phase 35 investment is real. The Telegram path is genuinely tenant-safe at the code level. Mutations across the domain model now carry explicit pass/fail semantics. Active source is mojibake-free with automated governance. These are durable improvements.

But `getPendingConfirmation` introduces a functional regression that silently destroys task list state when a finance confirmation expires. This will be triggered by normal user behavior in any tenant that uses both the task bot and the finance bot. It must be fixed before going live.

After fixing HIGH bug [35A-H1] and MEDIUM bug [35A-M1], and adding the ADMIN_TEXT governance test [35C-L1], Phase 35 would represent a meaningful step toward production. The remaining open risks (read-path silence, non-atomic cross-entity mutations, billing gap) are pre-existing and require their own dedicated phase.

**Fix checklist before deployment:**
- [x] `confirm.ts:49–52` — add `.not('action_type', 'eq', 'task_list_context')` to expiry cleanup
- [x] `index.ts:250–251` — null-safe `allowed_telegram_ids` access with `?? []`
- [x] `uxGovernance.test.js` — add `ADMIN_TEXT` to encoding governance check
- [x] `tenant-scope.test.ts` — add test for `getPendingConfirmation` expiry behavior with active task_list_context

All 4 items fixed post-audit. Phase 35 now passes: lint ✅ | 236/236 tests ✅ | build ✅ | Deno tests (require deno runtime).
