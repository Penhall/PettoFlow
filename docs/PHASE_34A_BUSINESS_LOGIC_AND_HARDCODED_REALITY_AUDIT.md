# PHASE_34A_BUSINESS_LOGIC_AND_HARDCODED_REALITY_AUDIT

Date: 2026-05-15  
Scope: NexusCRM / PettoFlow product-reality audit  
Posture: independent principal product/runtime audit

## 1. Executive Assessment

NexusCRM is no longer a pure prototype. The main authenticated app has real Supabase-backed persistence for core workspace CRUD: tasks, kanban columns, clients, activities, activity templates, accounts, payees, financial categories/rules, transactions, receivables, interaction logs, tenant onboarding state, memberships, billing metadata, audit logs, and notifications.

But the product is not uniformly real. The highest-risk illusion is the Telegram/bot system: the UI suggests tenant-aware operational automation, but the current bot functions still select a single global bot config and execute service-role business queries without tenant scoping. In a tenant-enforced schema, those commands are likely to fail on missing `tenant_id`; in a permissive or legacy schema, they risk cross-tenant behavior.

The second major risk is fake or weak success semantics. Many hooks catch persistence failures, log to console, return `null`/`false`, and rely on callers to notice. Several UI flows close modals or expose success-like states after awaiting functions that can return failure sentinels instead of throwing.

The third major risk is billing. SaaS billing has a real data model and Stripe webhook path, but customer-facing billing is operational only when Stripe is configured. Without Stripe env, the product explicitly displays a test-period/no-cost message and all resources appear available, while only selected creation limits are enforced server-side.

## 2. Product Reality Assessment

Reality classification:

| Area | Reality | Assessment |
|---|---:|---|
| Auth / tenant bootstrap | Real | Supabase auth, membership-based tenant loading, active tenant enforcement via headers. |
| Tasks CRUD | Mostly real | Server-persisted through `workspace-core`; UX and mutation semantics are incomplete. |
| Kanban/list/calendar task views | Partial | Views render real task state; filtering/sorting is client-only; calendar is derived, not persisted. |
| Activities | Mostly real | Activities/templates persist; transitions are thin status updates; reminders/notifications are partial. |
| Finance records | Partial-real | Transactions/accounts/receivables persist; calculations are local derivations, not ledger-grade. |
| Clients/CRM | Mostly real | Clients and interaction logs persist; relationships are loose JSON/FK-lite behavior. |
| Billing/SaaS | Partial | Real plan/subscription tables and Stripe path, but no full operational billing unless Stripe configured; enforcement incomplete. |
| Telegram/bot | Dangerous partial | Config UI persists, webhook exists, commands exist, but tenant scoping is broken/incomplete. |
| Onboarding/tutorial | Mostly real for state | State persists per tenant/user; seeded demo data is intentionally generated real rows. |
| Settings | Partial | Some settings are real; workspace profile settings have no substantive UI; several settings are integration-specific only. |
| Visual/runtime harnesses | Fake by design | Extensive fixtures exist and are test-gated, but visual confidence is fixture confidence. |

## 3. Real vs Partial vs Fake Feature Matrix

| Feature | Real | Partial | Fake / Placeholder | Notes |
|---|---:|---:|---:|---|
| Task create/update/delete/archive/restore | Yes |  |  | `App.jsx` calls `workspace-core`; persisted with `tenant_id`. |
| Task filtering/sorting |  | Yes |  | Client-only; no persisted views or server query semantics. |
| Task optimistic updates |  | Yes |  | Mostly post-confirmation, but stale secondary effects exist around receivables. |
| Kanban columns | Yes |  |  | Create/delete persisted; no robust reordering observed. |
| Activities timeline | Yes |  |  | Persisted activity rows. |
| Activity templates | Yes |  |  | Persisted templates; apply is client-side prefill. |
| Calendar integration |  | Yes |  | Derived from tasks/activities/receivables/transactions; no external calendar sync. |
| Transactions | Yes |  |  | Persisted, tenant-scoped through workspace-core. |
| Finance KPIs |  | Yes |  | Derived in frontend from fetched rows; not audited ledger balances. |
| Account balances |  | Yes |  | Locally computed; can use filtered transactions in account cards. |
| Receivable invoicing |  | Yes |  | Creates transaction then patches receivable; not atomic. |
| Clients | Yes |  |  | Persisted CRUD through workspace-core. |
| Client interaction history | Yes |  |  | Persisted interaction logs. |
| Billing plans/subscriptions | Yes | Yes |  | Real tables/admin CRUD; operational Stripe path depends on env. |
| Plan limit enforcement |  | Yes |  | Enforced for selected creates only. |
| Telegram config UI | Yes | Yes |  | Persists one global config path in functions despite tenant schema. |
| Telegram command execution |  | Yes | Dangerous | Real code, but not tenant-aware; may fail or cross-scope. |
| Onboarding completion/tutorial progress | Yes |  |  | Server-persisted per tenant/user. |
| Visual regression surfaces |  |  | Yes | Fixture-only and intentionally synthetic. |

## 4. Tasks-Domain Audit

Real:
- Task bootstrap, create, update, delete, archive, restore, archived listing are implemented in `workspace-core`.
- Mutations include explicit tenant headers from `App.jsx` and server-side `requireTenantAccess`.
- Terminal-column movement writes `completed_at`, so task completion is persisted.
- Onboarding-created tutorial tasks are real rows inserted by `seedTenantOnboardingData`.

Partial:
- Filtering and sorting are local React transforms over the current task array. They are not durable user views and do not prove backend query behavior.
- Kanban/list/calendar/overview are views over the same task array. Calendar events are derived, not a persisted calendar model.
- Task-to-receivable automation is non-atomic. In `App.jsx`, the task is updated first, then active accounts are fetched, then receivable creation is attempted. If receivable creation fails, the task remains completed and the financial side effect is lost.
- Delete/archive failures are console-only in several handlers. Example: `deleteTask` and `archiveTask` catch and log but do not alert or reconcile.

Hardcoded / dangerous:
- `related_to` is stripped from tasks before save in `App.jsx`, so task relation semantics exposed by some shared surfaces do not persist for tasks.
- Terminal status is inferred from the last current column. There is no explicit business status enum or server-side completion rule.
- Default status fallback remains `"A Fazer"` in modal/open paths.

Reality verdict: tasks are mostly real CRUD, but workflow semantics are not transactionally reliable.

## 5. Activities-Domain Audit

Real:
- Activity CRUD and activity-template CRUD persist through `workspace-core`.
- Activity timeline and template views use tenant-scoped hooks.
- Activity-created financial side effects can create transactions or receivables.

Partial:
- Activity transitions are simple status field updates. There is no server-enforced lifecycle model, retry model, or reconciliation process.
- Template application is a client-side prefill only.
- Activity financial side effects are not atomic with activity save. If a transaction or receivable creation fails after the activity is saved, the UI can keep the saved activity without the intended financial record.
- Calendar integration is local derivation through `useCalendarEvents`; there is no real external calendar sync.

Placeholder behavior:
- Activity reminders and notifications are partially implemented through `notification-worker`, but there is no evidence this worker is scheduled or operationally guaranteed from the frontend path.

Reality verdict: activity records are real; activity workflow automation is partial.

## 6. Finance-Domain Audit

Real:
- Accounts, payees, category groups, categories, rules, transactions, and receivables are persisted with tenant scoping through `workspace-core`.
- Finance totals are derived from actual fetched rows, not hardcoded metrics.
- Transaction creation runs the rules engine client-side before persistence.

Partial / not trustworthy as finance system:
- Balances in account cards are calculated from `transactions` for the active extract filters, while summary totals use `allTransactions`. In `FinanceView.jsx`, account balances use the filtered transaction list, so filtering the extract can make account cards display filtered balances rather than actual balances.
- `calculateFinanceTotals` only counts cleared transactions for current balance and uncleared negative transactions as payable. That is a product rule, but it is frontend-only and not enforced server-side.
- Receivable invoicing performs transaction creation and receivable update in two separate requests. If transaction creation succeeds and receivable update fails, the ledger and receivable state diverge.
- `applyRules` iterates pending transactions one by one; partial failure can leave mixed state.
- There is no double-entry ledger, no immutable journal, no server-side balance table, no reconciliation audit trail, and no transactional accounting guarantees.

Fake / disconnected:
- Charts are not a core finance source of truth; visual finance screens use fixture data in visual mode.
- `A Pagar` is inferred from uncleared negative transactions, not from a payable model.

Reality verdict: finance is useful operational tracking, not accounting-grade finance.

## 7. CRM-Domain Audit

Real:
- Client CRUD persists through `saveClientRecord` and `deleteClientRecord`.
- Client profile interaction logs persist through `interaction_logs`.
- Client-related tasks are derived from `task.client_id`, and client-related finance can be queried via `related_to`.

Partial:
- CRM relationship semantics are inconsistent: tasks use `client_id`, transactions use JSON `related_to`, activities use JSON `related_to`, and interaction logs use `client_id`.
- Client save/delete failures are console-only in `ClientesView`; no user-visible failure state is guaranteed.
- Import contacts is not implemented. The empty-state CTA routes to tutorial/open help behavior, not an import flow.
- Client profile transaction edit/delete handlers are no-ops in the embedded transaction list.

Reality verdict: CRM storage is real; CRM workflows are shallow and relation modeling is fragmented.

## 8. Billing / SaaS Audit

Real:
- Tenant creation creates a default subscription when an active `free` plan exists.
- Admin plan CRUD is real through `admin-core`.
- Billing overview reads subscription, usage snapshot, plans, and manageability.
- Stripe checkout, portal creation, webhook verification, event recording, and subscription synchronization are implemented.

Partial:
- Customer billing works only when Stripe env is configured. Otherwise the billing page explicitly presents a test/no-cost state.
- Plan switching in admin updates internal subscriptions directly. That is real metadata, not provider billing.
- Limit enforcement exists in `workspace-core` for tasks, clients, activities, and transactions. It does not cover all SaaS limits uniformly at every mutation surface.
- Access enforcement is not feature-gate complete. The UI can show modules regardless of plan; selected create operations may fail at server side.

Fake / simulation:
- Without Stripe config, plan cards and billing status become a SaaS simulation. The product can look like billing exists while no customer payment lifecycle is active.

Reality verdict: SaaS foundations are real; operational SaaS billing is partial and environment-dependent.

## 9. Telegram / Bot Audit

Real:
- Telegram config, encrypted token storage, webhook registration/deletion, command records, slash parsing, LLM parsing, voice transcription path, and pending confirmations are implemented as code.
- Built-in commands and custom command execution exist.

Operationally dangerous:
- `telegram-webhook` selects `.from('bot_configs').limit(1).single()` and then commands by `bot_config_id`. It does not resolve tenant from Telegram sender, chat, bot config tenant, or request path.
- `bot-config` and `bot-commands` also use single global config lookup with service role and no `X-Tenant-Id`.
- Bot action functions read/write business tables without `tenant_id`. Examples: task insert only `{ title, status, priority }`; transaction insert only account/amount/date/notes; activities insert no tenant.
- Because later migrations make business `tenant_id` non-null and RLS tenant-aware, these bot commands are likely broken in a correctly migrated production schema. If they are not broken, that implies legacy/null tenant data or service-role bypass is masking a serious tenant isolation problem.
- Telegram allowlist is stored on config, not tenant/user mapping. `/start` bootstraps a Telegram ID into whichever single config row was selected.

Partial:
- Confirmation/retry behavior exists for high-value finance commands, but pending confirmations are chat-scoped rather than tenant/user scoped.
- Disabled built-ins silently no-op with HTTP 200 and no user feedback.

Reality verdict: bot UI is real enough to configure secrets, but product execution is not tenant-real. Treat this domain as dangerous partial, not production-ready.

## 10. Onboarding / Tutorial Audit

Real:
- Onboarding state persists in `tenant_onboarding_state` per tenant/user.
- Onboarding events persist in `tenant_onboarding_events`.
- Tenant creation seeds real initial data: columns, clients, tasks, account, activity, transaction, tutorial tasks, and a seed profile.
- Hook mutation queuing reduces stale overwrites for rapid onboarding updates.

Partial:
- Some UI actions fire-and-forget onboarding updates. If a patch fails, the current UI may still move on visually.
- Dismissals, tutorial opened/completed state, and tour state are real server updates, but they are product guidance state, not proof the underlying operational setup was completed.
- `completed_onboarding_version` exists but completion semantics are checklist-derived and not a hard operational readiness gate.

Reality verdict: onboarding persistence is real; completion is guidance completion, not product readiness.

## 11. Settings Audit

Real:
- Members/invitations are real through `invite-member`.
- Billing settings are real/partial as described above.
- MFA UI uses Supabase auth paths.
- Audit timeline is tenant-scoped through `tenant-core`.
- Telegram and command settings persist through Edge Functions.

Partial / placeholder:
- Workspace settings API can update `tenant_settings.workspace_profile`, but the visible Workspace tab is only create-workspace onboarding. There is no complete workspace profile editor.
- Theme is local-only.
- Telegram settings are not tenant-real despite appearing in tenant settings.
- Several settings flows show errors, but others depend on console logging or local state refresh.

Reality verdict: settings is a collection of real subflows plus placeholders, not a coherent tenant settings model.

## 12. Mock / Fixture Inventory

Harmless dev scaffolding:
- `src/visual/fixtures.js` contains synthetic tasks, clients, activities, finance records, and interaction logs for visual regression.
- `src/visual/VisualRegressionApp.jsx`, `RuntimeHarnessApp.jsx`, `MockProviders.jsx`, and `harnessFixtures.js` are test/harness surfaces.
- `src/lib/runtimeFixture.js` provides in-browser fixture Supabase behavior only in dev mode with `?runtime-fixture=1`.

Dangerous if mistaken for production proof:
- Playwright runtime confidence is heavily fixture-backed. These tests prove mounted runtime behavior under synthetic data; they do not prove real Supabase persistence, RLS, billing provider behavior, or Telegram tenant correctness.
- Visual screenshots are fixture screenshots. Passing visual baselines would not mean product logic is real.

Seeded demo values:
- Onboarding seed data is not fake UI data; it creates real rows. It is still demo-shaped business reality and should be labeled/managed as seeded starter data.

Production-risk placeholders:
- Telegram global single-config behavior.
- Billing no-cost/test mode without hard feature gates.
- Import contacts CTA without import implementation.
- Client profile embedded transaction actions as no-ops.

## 13. localStorage / Client-Only Persistence Audit

Real local-only state:
- `nexuscrm_active_tenant_id` stores active tenant fallback in `localStorage`.
- `pettoflow_theme` stores theme in `localStorage`.
- `lazyWithRetry` uses `sessionStorage` to avoid repeated lazy import reload loops.

Risk:
- Active tenant `localStorage` is used as a runtime fallback in `getRequiredActiveTenantId`. It solves a React timing race, but it is still client-side memory of tenant intent. If old call sites omit explicit tenant, production can fall back to a client-stored tenant.
- This creates a persistence illusion: tenant selection survives reload locally, but it is not server preference state.

Not seen:
- No broad use of `localStorage` for tasks, activities, finance, clients, onboarding, billing, or settings data. That is good.

Reality verdict: local persistence is narrow, but the active tenant fallback remains a correctness risk for implicit ownership paths.

## 14. Supabase / Backend Integration Audit

Real:
- Main app functions require authenticated users and tenant access.
- Business-table migrations add `tenant_id`, indexes, and RLS policies.
- `workspace-core` injects tenant IDs server-side and scopes reads/mutations by tenant.
- `tenant-core` handles tenants, onboarding, settings, billing overview, checkout/portal, and audit logs.
- Admin functions use platform admin checks.

Partial:
- Some direct frontend Supabase calls remain, such as notifications and storage. They depend on RLS correctness instead of function-level tenant checks.
- Retry semantics are mostly UI retry/reload behavior, not durable backend job queues.
- Atomic business workflows are mostly absent. Multi-step flows are separate HTTP calls.

Broken/incomplete:
- Telegram functions bypass tenant-core/workspace-core and use service-role Supabase directly without tenant resolution.
- Bot config/commands functions have not converged to the tenant schema.

Reality verdict: backend integration for the web app is real; integration consistency is incomplete across bot and some direct Supabase paths.

## 15. Fake-Success UX Findings

Critical fake-success patterns:
- Hooks such as `useTransactions`, `useActivities`, `useAccounts`, `useFinRules`, `useFinCategories`, `usePayees`, `useReceivables`, and `useActivityTemplates` catch errors and return `null`/`false`.
- `FinanceView.handleSaveTransaction` closes the transaction modal after `await addTransaction(form)` without checking whether it returned `null`.
- Account and rule save handlers similarly close/edit-reset without always verifying persistence success.
- Client save/delete errors are console-only.
- Task delete/archive errors are console-only.
- Telegram disabled built-in commands return 200 with no user message.
- Billing success feedback says checkout completed and to wait for Stripe sync; that is correct as a pending state, but it can appear as product success before webhook reconciliation.

Less severe:
- Loading skeletons are not fake by themselves, but many visual tests use fixture mode, so “loaded” in tests does not mean backend loaded.
- Onboarding tour completion can visually close before every related checklist/event update is confirmed.

Reality verdict: the app often avoids optimistic local mutation, which is good, but too many flows silently degrade failure into console logs or closed modals.

## 16. Operational Completeness Assessment

Operationally complete enough:
- Authenticated tenant bootstrap.
- Core workspace CRUD through web UI.
- Onboarding state persistence.
- Admin plan CRUD and internal subscription records.

Operationally partial:
- Finance workflows.
- Billing/provider lifecycle.
- Notifications/reminders.
- CRM relationship graph.
- Calendar.
- Settings.

Operationally incomplete/dangerous:
- Telegram/bot tenant execution.
- Atomic financial side effects.
- Server-side workflow state machines.
- Cross-domain reconciliation after partial failures.

## 17. Highest-Risk Product Illusions

1. Telegram appears integrated but is not tenant-real.
2. Billing appears SaaS-complete but can be internal/test-only with no Stripe lifecycle.
3. Finance appears dashboard-grade but is not ledger-grade and contains frontend-only balance logic.
4. Visual/runtime tests appear broad but depend heavily on fixtures.
5. Onboarding completion can look like operational readiness while only guide state was completed.
6. Several “save” flows can close or move on after a swallowed failed mutation.

## 18. Production-Readiness Reassessment

The runtime may be operationally stable, but the product is not fully production-real.

Production-ready for controlled internal use:
- Tenant-authenticated web CRUD.
- Basic operational task/client/activity tracking.
- Simple finance tracking where accounting correctness is not legally relied upon.
- Guided onboarding with seeded starter data.

Not production-ready as claimed SaaS:
- Telegram automation.
- Billing enforcement and plan-gated access.
- Financial correctness and reconciliation.
- Import/contact automation.
- External calendar semantics.
- Durable retry/reconciliation workflows.

## 19. Immediate Priorities for Convergence

1. Make bot config, commands, webhook auth, pending confirmations, and command actions tenant-aware. Route bot mutations through `workspace-core` or equivalent tenant-scoped services.
2. Replace hook-level swallowed mutation failures with explicit error propagation or standardized mutation result handling. Do not close save modals on `null`.
3. Make financial side effects atomic where possible: task completion + receivable creation, activity save + financial record, receivable invoice + transaction.
4. Move finance balance/KPI derivation to a consistent backend query/RPC or clearly label frontend-derived operational estimates.
5. Complete billing enforcement: plan gates in backend for all relevant resources, UI feature gates, and explicit non-Stripe/test-mode labeling.
6. Replace import/contact placeholder CTAs with real import implementation or remove them.
7. Add real Supabase integration tests for tenant switching, reload persistence, interrupted mutations, and webhook/bot tenant isolation.
8. Fix `playwright.config.js` to be cross-platform (`npm run dev`, not `npm.cmd run dev`) and update or review visual baselines.

## Validation

Requested commands were adapted for this Linux environment because `npm.cmd` is Windows-specific.

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm test` | PASS: 50 files, 225 tests. Expected console error from provider-boundary test appears but suite passes. |
| `npm run build` | PASS |
| `npm run test:visual` | FAIL before tests: Playwright webServer uses `npm.cmd`, which is unavailable on Linux. |
| Linux-compatible visual run with dev server already running and webServer disabled | FAIL: 222 passed, 9 failed. Failures: visual screenshot drift on finance/dashboard/activities/clients/team/calendar and one mobile orchestration assertion expecting `TENANT_LOADING`. |

Validation note: the visual suite is runtime/fixture-heavy. Its failures matter for UI regression, but its passes do not prove business persistence.
