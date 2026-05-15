# PHASE_34B_DATA_FLOW_AND_PERSISTENCE_AUDIT

Independent principal data-flow audit for NexusCRM/PettoFlow.

Objective: map the real data topology, persistence guarantees, ownership propagation, async reconciliation, fallback behavior, and integrity risks that determine whether the data model is operationally trustworthy.

## Executive Finding

The core browser-to-workspace path is partially trustworthy: authenticated frontend calls generally flow through `workspace-core`, carry `X-Tenant-Id`, and the Edge Function re-checks active membership before scoping every business query by `tenant_id`. That is the strongest part of the system.

The full data model is not yet operationally trustworthy end-to-end. The system has multiple persistence surfaces with different semantics:

- Tenant-scoped business CRUD is mostly request-confirmed and RLS-backed.
- Frontend hooks often swallow failed mutations and return `null`/`false`, which creates fake consistency at the UI boundary.
- Multi-step business mutations are not transactional and can leave partial state.
- Runtime fixture and visual fixture modes create local-only/fake persistence paths.
- Telegram bot config and webhook flows bypass the main ownership propagation model and still behave like a single global bot in several places.
- Async reconciliation is implemented for bootstrap and onboarding, but not uniformly across all hooks and mutation chains.

Highest-risk conclusion: tenant isolation is strong in the main workspace API, weaker in direct Supabase/storage paths, and materially unsafe in the Telegram bot path unless constrained to a single-tenant deployment.

## Persistence Topology

| Layer | Location | Persistence | Ownership input | Trust level |
| --- | --- | --- | --- | --- |
| React component state | `App.jsx`, views, hooks | In-memory only | Usually `activeTenantId` from `TenantContext` | Medium for display, low as source of truth |
| Runtime orchestration state | `RuntimeOrchestrationContext.jsx`, `runtimeOrchestration.js` | In-memory plus diagnostic globals | Derived from auth/tenant/workspace events | UI/runtime only, not durable |
| Active tenant fallback | `localStorage[nexuscrm_active_tenant_id]` | Browser localStorage | Previously selected tenant id | Convenience only, not authority |
| Runtime fixture | `runtimeFixture.js` | In-memory JS object, dev URL flag | Fixture tenant ids | Fake persistence |
| Visual fixture | `visual/fixtureRuntime.js`, hooks | Static in-memory fixtures | None/fixture | Fake persistence |
| Supabase Auth | `AuthContext.jsx`, Supabase SDK | Supabase Auth | Session/user | Strong external source |
| Edge Function facade | `workspace-core`, `tenant-core`, `invite-member`, `admin-core` | Supabase Postgres via server code | JWT plus `X-Tenant-Id`, membership checks | Strongest path |
| Direct Supabase table access | notifications, attachments, MFA, platform-admin RPC | Supabase Postgres/Auth/Storage | RLS or user identity | Mixed |
| Supabase Storage | `storage.js`, storage policies | Storage object plus `file_attachments` row | Path includes tenant id; RLS checks membership | Medium; two-phase writes |
| Cron/worker writes | `notification-worker`, `stripe-webhook` | Service-role writes | Secret/webhook metadata | Medium; service-role bypass requires app logic |
| Telegram webhook writes | `telegram-webhook/actions/*` | Service-role writes | Telegram allowlist only; no tenant propagated | Low in multi-tenant model |

## Major Data Flows

### Auth and Tenant Bootstrap

Flow:

1. `AuthContext` loads Supabase session with `supabase.auth.getSession()`.
2. `TenantContext` calls `tenant-core/tenants` through `authenticatedFetch`.
3. Tenant list is normalized into React state.
4. Active tenant is resolved from `localStorage` if still accessible, from the only tenant if there is exactly one, or `null`.
5. Active tenant is stored in both module memory and localStorage.
6. `App` bootstraps workspace data with `fetchWorkspaceBootstrap(activeTenantId)`.

Persistence reality:

- Auth session is durable in Supabase client storage.
- Tenant membership is real Postgres data.
- Active tenant selection is local browser preference only.
- Runtime orchestration state is not persisted and is not a data authority.

Trust notes:

- Tenant list load has cancellation guards.
- Workspace bootstrap has cancellation guards.
- `localStorage` fallback is intentionally non-authoritative but can still influence implicit workspace requests when strict ownership is off.

### Workspace CRUD

Flow:

1. UI/hook calls `workspaceCoreRequest(path, { tenantId })`.
2. `authenticatedFetch` obtains Supabase access token and sends `Authorization` plus `X-Tenant-Id`.
3. `workspace-core` authenticates the JWT.
4. `workspace-core` calls `requireTenantAccess`, which checks `memberships` for active membership.
5. Every business table query is scoped with `.eq('tenant_id', tenantId)`.
6. Mutations inject `tenant_id` server-side before insert/update.

Persisted tables include:

- `tasks`
- `kanban_columns`
- `team`
- `clients`
- `activities`
- `activity_templates`
- `accounts`
- `payees`
- `fin_rules`
- `category_groups`
- `fin_categories`
- `transactions`
- `receivables`
- `interaction_logs`

Trust notes:

- This is the most trustworthy path.
- The Edge Function uses both function-level tenant access and database RLS via user-scoped Supabase client.
- Server-side field allowlists reduce accidental tenant/body injection.
- Several frontend hooks still swallow errors, so UI callers may not know persistence failed unless they inspect return values.

### Onboarding State

Flow:

1. `useOnboarding({ tenantId })` loads `tenant-core/tenants/:tenantId/onboarding`.
2. Edge Function checks path/header tenant match and active membership.
3. Data is stored in `tenant_onboarding_state` per `(tenant_id, user_id)`.
4. Events are appended to `tenant_onboarding_events`.
5. Frontend serializes patch mutations through a promise queue.

Guarantees:

- Strong tenant isolation at the API boundary.
- Per-user onboarding persistence is real.
- Mutation queue avoids stale overwrite across rapid local onboarding patches.

Residual risk:

- Failed patches return `null`; UI surfaces do not always expose the failed persistence.
- Event writes happen after state patch in several flows and may be lost independently.

### Membership and Invitations

Flow:

1. `useMembers` calls `invite-member` functions with active tenant.
2. Edge Function requires JWT, `X-Tenant-Id`, path/header match, and active membership.
3. Role/status mutations execute database RPCs.
4. Audit logs are written after successful operations.

Guarantees:

- Tenant access and management roles are enforced by RPCs and function checks.
- Last-owner and self-action constraints are implemented in database functions.

Residual risk:

- Email delivery is external and not transactional with invitation creation.
- Audit log write failures are not consistently treated as user-visible mutation failures.

### Billing

Flow:

1. Tenant billing UI calls `tenant-core/tenants/:tenantId/billing`.
2. Checkout creates or reuses Stripe customer and writes pending subscription metadata.
3. Stripe webhook verifies signature, records billing event, updates subscription, records processed event, writes audit log.

Guarantees:

- Tenant billing reads and checkout are owner/admin gated.
- Stripe webhook idempotency exists through unique `(provider, event_id)` and processed checks.

Residual risk:

- Checkout is a multi-step external mutation. Customer/session creation and local subscription update are not atomic.
- Webhook event lifecycle records `received`, then `processed`/`failed`, but duplicate handling depends on existing status.
- Billing consistency is eventually reconciled by Stripe webhook, not immediately guaranteed by checkout.

### Notifications

Flow:

1. `notification-worker` is called with `CRON_SECRET`.
2. It selects pending activities in the next 15 minutes.
3. It creates per-user notification rows for active memberships.
4. It sends Telegram reminders if a bot config exists for that activity tenant.
5. It marks the activity `notified_at`.
6. Frontend `useNotifications` directly queries `notifications` through Supabase.

Guarantees:

- Notification rows are unique on `(user_id, resource_type, resource_id, type)`.
- Frontend notification reads and read-state updates rely on RLS by `user_id`.

Residual risk:

- Worker uses service role and must enforce tenant logic itself.
- Telegram send and notification row creation are not atomic.
- `notified_at` is updated by activity id only, not additionally by tenant id.

### Files and Attachments

Flow:

1. `uploadFile` writes object to Supabase Storage path `${tenantId}/${entityType}/${entityId}/...`.
2. It inserts a `file_attachments` metadata row with `tenant_id`.
3. If metadata insert fails, it attempts to remove the uploaded object.
4. `listAttachments` queries metadata by entity and optionally tenant id.
5. `getFileUrl` creates a signed URL by storage path.

Guarantees:

- Storage policies check the first path segment against active memberships.
- Metadata table has tenant RLS.

Residual risk:

- Upload is a two-phase write. If cleanup fails after metadata insert failure, orphan storage objects remain.
- `deleteFile` removes storage first, then DB row. If DB delete fails, metadata can point to a missing object.
- `listAttachments` returns `[]` on error, silently degrading failed reads into empty state.
- `listAttachments` permits omitted tenant id; RLS still protects data, but call-site ownership is weaker.

### Admin Console

Flow:

1. Admin UI calls `admin-core` through `authenticatedFetch` or `adminFetch`.
2. `admin-core` authenticates and checks platform admin except `claim-master`.
3. Service-role queries list tenants, users, subscriptions, audit, billing events.

Guarantees:

- Platform admin gate exists on server for admin data.
- Admin operations intentionally cross tenant boundaries.

Residual risk:

- `adminFetch` does not handle missing Supabase client as defensively as `authenticatedFetch`.
- Admin service-role access is intentionally broad; correctness depends on `requirePlatformAdmin`.

### Telegram Bot

Flow:

1. `bot-config` stores encrypted Telegram/LLM secrets in `bot_configs`.
2. `bot-commands` stores commands in `bot_commands`.
3. `telegram-webhook` reads a single `bot_configs` row with `.limit(1).single()`.
4. It validates Telegram secret and allowlist.
5. It executes actions with service-role Supabase client.
6. Action modules read/write `tasks`, `activities`, `accounts`, `transactions`, and `bot_pending_confirmations`.

Persistence reality:

- Bot config and commands are real Postgres rows.
- Pending confirmations are real Postgres rows.
- Bot-created tasks/activities/transactions attempt real business writes.

Critical isolation finding:

- The bot path does not propagate tenant id into action reads/writes.
- Bot config/commands APIs do not require active tenant or `X-Tenant-Id`.
- The webhook uses a single global config lookup, not tenant-scoped config selection.
- Action writes omit `tenant_id`; if business tables enforce `tenant_id not null`, these writes fail. If legacy nullable state exists, writes can become tenantless/orphaned.
- Action reads are unscoped and can cross tenants when executed under service role.

This path is not trustworthy for multi-tenant operation.

## Trust Matrix

| Flow | Persisted? | Tenant isolated? | Async-safe? | Silent degradation? | Verdict |
| --- | --- | --- | --- | --- | --- |
| Auth session | Yes | User-scoped | Mostly | Some background admin flag failure | Trustworthy |
| Tenant list | Yes | Yes | Cancellation guarded | Error visible in context | Trustworthy |
| Active tenant selection | Browser only | Validated against tenant list | N/A | Can clear silently | Preference only |
| Workspace bootstrap | Read only | Yes | Cancellation guarded | Bootstrap error visible | Trustworthy for reads |
| Task CRUD | Yes | Yes via API/RLS | Basic request-confirmed | Some handlers only log | Mostly trustworthy |
| Task completion to receivable | Yes, multi-table | Yes | Not transactional | Yes, receivable failure can leave task complete | Risky |
| Finance transaction CRUD | Yes | Yes via API/RLS | Basic request-confirmed | Hook returns null/false | Mostly trustworthy |
| Receivable invoicing | Yes, multi-table | Yes | Not transactional | Yes, transaction may persist while receivable update fails | High risk |
| Account principal change | Yes, multi-row | Yes | Not transactional | Yes | High risk |
| Onboarding state | Yes | Yes | Serialized queue | Failed patch returns null | Strong but failure-muted |
| Onboarding events | Yes | Yes | Fire-and-forget in places | Yes | Best-effort analytics |
| Notifications | Yes | User RLS | Worker idempotency partial | Read failure becomes empty list | Medium |
| File upload | Storage plus DB | Mostly | Two-phase, cleanup best-effort | List errors become empty | Medium |
| Membership/invites | Yes | Yes | Refresh after mutation | Email delivery external | Strong core, external partials |
| Billing checkout | Yes plus Stripe | Yes | Eventually consistent | Stripe/config errors visible | Medium |
| Stripe webhook | Yes | Metadata-derived | Idempotent event record | Failed events recorded | Medium |
| Admin console | Yes | Platform-admin gated | Request-confirmed | UI-dependent | Powerful, high blast radius |
| Runtime fixture | No durable backend | Fixture only | In-memory | Looks successful | Fake persistence |
| Visual fixture | No durable backend | None | N/A | Looks successful | Fake persistence |
| Telegram bot actions | Yes or failed/orphaned | No end-to-end tenant propagation | Confirmation state only | Errors sent as generic Telegram message | Not trustworthy |

## Tenant Isolation Findings

### Strong Boundaries

- `workspace-core` requires JWT, requires tenant header, checks active membership, and scopes business table operations by `tenant_id`.
- `tenant-core` checks path/header tenant match for tenant-specific routes.
- `invite-member` checks path/header tenant match and uses tenant-aware RPCs.
- Business-table RLS policies exist for active tenant membership.
- Storage object policies use tenant id as the first path segment.

### Weak Boundaries

- `workspaceCoreRequest` still supports implicit tenant fallback from module state/localStorage when strict mode is off.
- Direct Supabase paths depend on RLS rather than the unified Edge Function ownership contract.
- `listAttachments` can be called without tenant id.
- Notification worker uses service role and partially scopes by tenant in application code.
- Admin paths intentionally bypass tenant isolation under platform-admin authority.

### Broken Boundary

- Telegram bot flows are not tenant-safe. The config is selected globally, commands are global, action reads/writes are unscoped, and service role bypasses RLS. This is the highest tenant isolation defect in the audit.

## Async Reconciliation Findings

### Implemented Reconciliation

- Tenant bootstrap uses an `active` flag and cancels orchestration state on cleanup.
- Workspace bootstrap uses `cancelled` and request ids.
- App-level team/client refresh uses per-scope request ids and active tenant comparison before committing.
- Runtime orchestration reducer drops stale tenant/workspace request ids.
- Onboarding mutations are serialized through a promise queue and compute payloads from the latest server-confirmed state.
- `authenticatedFetch` has a 15-second timeout and chains external abort signals.

### Missing or Uneven Reconciliation

- Most hooks use only a local `cancelled` flag for initial load and no stale-response guard for explicit `refresh()` calls.
- Mutations generally do not guard against active tenant changing during the mutation. The request is sent to the tenant captured by closure, then local state may update after the user switches tenant if the component remains mounted.
- Multi-step flows do not use server-side transactions or idempotency keys.
- Fire-and-forget onboarding event writes and tour updates can fail after UI has moved on.
- No offline queue exists. Failed writes are failed writes, often reduced to `null`/`false`.

## Persistence Guarantees

### Strong Guarantees

- A successful `workspace-core` mutation response means the target row was written under the requested tenant.
- A successful onboarding state patch means the `(tenant_id, user_id)` state row was upserted.
- A successful membership RPC means role/status/membership invariants were enforced by database logic.
- A processed Stripe webhook has a durable `billing_events` record and subscription update path.

### Eventual Guarantees

- Billing plan/subscription reality is eventually reconciled from Stripe webhooks after checkout.
- Notification rows are eventually created by scheduled worker execution.
- Frontend state is eventually refreshed from server after some mutations, but not all.

### Fake or Weak Guarantees

- Runtime and visual fixtures can make mutations appear successful without durable backend persistence.
- Hooks that catch errors and return `null`/`false` create caller-dependent consistency; the system does not uniformly surface failed persistence.
- Onboarding analytics/events are best-effort relative to primary onboarding state.
- File storage and metadata can diverge because upload/delete are two-phase.

## Failure Modes

| Failure | Actual behavior | Data risk |
| --- | --- | --- |
| Supabase client missing | Auth/API paths throw or show unconfigured state | No persistence |
| Auth token missing | `authenticatedFetch` throws `AUTH_SESSION_MISSING` | No persistence |
| Tenant missing | Workspace calls throw unless hook short-circuits | No persistence |
| Workspace bootstrap failure | App shows retryable bootstrap error | No local data mutation |
| Hook fetch failure | Many hooks log error and stop loading | Empty/stale UI can appear valid |
| Hook mutation failure | Many hooks log and return null/false | Caller may silently continue |
| Tenant switch during fetch | Main bootstrap guarded; some hook refreshes less guarded | Possible stale local commit |
| Tenant switch during mutation | Request persists to old tenant; local commit can land in current UI | Wrong-screen state risk |
| Task completion receivable failure | Task remains complete, receivable absent | Business inconsistency |
| Receivable invoice partial failure | Transaction can exist while receivable remains pending | Duplicate invoice risk |
| Account principal update partial failure | Old account demoted, new account update can fail | No principal account risk |
| Storage upload DB insert failure | Attempts storage cleanup | Orphan object if cleanup fails |
| Storage delete DB failure | Object removed, row remains | Broken attachment record |
| Notification worker partial failure | Per-activity continues or skips | Missing reminders or duplicate sends |
| Stripe webhook failure | Failed billing event recorded when event id known | Needs operational replay |
| Telegram bot write failure | Generic Telegram error | User cannot tell which persistence invariant failed |
| Telegram bot write success without tenant | Tenantless/cross-tenant data if DB allows it | Critical isolation breach |

## Highest-Risk Flows

1. **Telegram bot actions**
   - Global config lookup.
   - Service-role reads/writes.
   - No tenant propagation.
   - Business writes omit `tenant_id`.
   - Confirmation state keyed by `chat_id`, not tenant.

2. **Receivable invoicing**
   - Creates transaction first.
   - Updates receivable second.
   - No transaction/idempotency.
   - Failure after transaction creates duplicate/partial billing risk.

3. **Task completion to receivable**
   - Task update commits before receivable creation.
   - Account lookup and receivable insert are separate requests.
   - Failure leaves task financially incomplete.

4. **Principal account reassignment**
   - Demotes current principal then updates target account.
   - No atomic invariant that exactly one principal exists.

5. **File upload/delete**
   - Storage object and metadata row can diverge.
   - Error paths are best-effort cleanup.

6. **Implicit tenant fallback**
   - Production can still infer tenant from module state/localStorage when strict mode is off.
   - This is less risky than before because major hooks pass explicit tenant ids, but it remains a trust downgrade.

## Operational Consistency Findings

- There is no durable client-side retry queue.
- There is no offline write support.
- There are no idempotency keys for user-triggered mutations.
- There is no unified mutation state model across hooks.
- Read models are split between bootstrap payloads and per-domain list hooks, causing independent refresh timing and possible temporary divergence.
- Server-side APIs protect tenant ownership better than frontend APIs express persistence failure.
- Some modules use request-confirmed state updates; others refetch after mutation; others fire-and-forget analytics.
- Diagnostics capture async failures, ownership traces, cancellations, and transitions, but diagnostics do not enforce correctness.

## Recommended Convergence Priorities

### P0: Fix Telegram Tenant Ownership

- Make `bot_configs` tenant-scoped at API level.
- Require active tenant for bot config and commands management.
- Register webhook with a tenant-specific secret or route mapping.
- Resolve tenant from webhook secret/config row.
- Pass tenant id into all Telegram action functions.
- Scope all Telegram reads/writes by tenant id.
- Insert `tenant_id` into tasks, activities, transactions, confirmations, and commands.
- Key pending confirmations by `(tenant_id, chat_id, action_type)`.

### P1: Move Cross-Entity Business Mutations Server-Side

- Add a server endpoint for task completion that atomically updates task and creates receivable when applicable.
- Add a server endpoint for invoice receivable that atomically creates transaction and marks receivable invoiced.
- Add a server endpoint/RPC for principal account changes with a database invariant.
- Add idempotency keys to these endpoints.

### P1: Eliminate Silent Mutation Failure

- Standardize hooks to either throw mutation errors or expose a consistent `{ ok, data, error }` result.
- Stop returning `null`/`false` for persistence failures unless the caller is required to handle it.
- Add visible error state for domain hooks where persistence matters.

### P2: Promote Strict Tenant Ownership

- Make strict tenant ownership default outside test exceptions.
- Remove localStorage implicit fallback from mutation-capable paths.
- Keep localStorage only for tenant selection preference, not request ownership.

### P2: Harden Storage Consistency

- Require tenant id in all attachment list calls.
- Add tenant id to delete filters where possible.
- Add periodic orphan detection for storage objects and `file_attachments`.
- Prefer a server-mediated attachment API if attachment rules grow.

### P2: Reconcile Read Models

- Consolidate bootstrap and per-domain fetch ownership into a shared cache or query layer.
- Add stale-response checks to explicit refresh functions, not only mount effects.
- Guard mutation local commits against tenant changes between request start and response.

### P3: Operational Replay and Observability

- Add replay/admin tooling for failed Stripe webhook events.
- Add notification worker run records and per-activity failure tracking.
- Add audit coverage for key workspace mutations if compliance requires it.

## Final Verdict

The main workspace data model is close to trustworthy when accessed through `workspace-core` with explicit tenant id. The overall system is not yet trustworthy as a complete operational data model because persistence semantics are inconsistent, cross-entity mutations are not atomic, and the Telegram path bypasses tenant ownership semantics.

The convergence path is clear: tenant-scope the bot, move multi-row business workflows into server transactions/RPCs, remove silent mutation failure, and promote strict tenant ownership from diagnostic mode to default runtime contract.
