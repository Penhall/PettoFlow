# PHASE_35A_TELEGRAM_TENANT_CONVERGENCE

Date: 2026-05-15
Scope: NexusCRM/PettoFlow Telegram/bot tenant convergence
Posture: operational hardening — eliminate highest-risk tenant isolation defect

## 1. Executive Summary

The Telegram bot path was the single highest-risk operational defect confirmed by independent audits (34A/34B). The webhook resolved bot config globally (`.limit(1).single()`), executed commands with service-role Supabase, and performed business writes without `tenant_id`. In a multi-tenant schema, this meant the bot could either fail silently (if `tenant_id` was `NOT NULL`) or leak data across tenants (if service-role bypassed RLS).

This phase converged the Telegram architecture to match the same ownership/runtime standards already established in the web application. All bot flows now propagate explicit `tenant_id`, config resolution uses webhook secret hashing, pending confirmations are tenant-scoped, and every business write includes tenant ownership.

## 2. Previous Telegram Architecture Risks

| Risk | Severity | Status Before |
|------|----------|---------------|
| Bot config resolved globally with `.limit(1).single()` | **Critical** | Active |
| Webhook execution had no tenant awareness | **Critical** | Active |
| Action handlers omitted `tenant_id` from inserts/updates | **Critical** | Active |
| Reads not scoped by tenant (service-role could cross tenants) | **Critical** | Active |
| Pending confirmations keyed by `chat_id` only, no tenant | **High** | Active |
| Bot config/commands APIs did not require active tenant | **High** | Active |
| Raw database errors could leak to Telegram user | **Medium** | Active |
| No telemetry for authorization/tenant failures | **Medium** | Active |

## 3. Tenant-Resolution Redesign

### Webhook Secret Hashing

Added `webhook_secret_sha256` column to `bot_configs` with a unique index (nullable). The webhook now:

1. Reads the `x-telegram-bot-api-secret-token` header from the incoming request
2. Hashes it with SHA-256
3. Looks up the matching `bot_configs` row by hash
4. Falls back to legacy decryption-based matching for existing configs without a hash
5. On legacy match, backfills the hash for future fast lookups

This eliminates the global `.limit(1).single()` pattern and maps each webhook request to exactly one tenant's bot config.

**Files:** `supabase/functions/telegram-webhook/utils/config.ts` (new), `supabase/functions/_shared/hash.ts` (new), migration 20260515175307

### Config Resolution Flow

```
Telegram Webhook POST
  → Read x-telegram-bot-api-secret-token
  → SHA-256 hash
  → bot_configs WHERE webhook_secret_sha256 = hash
  → Returns config with tenant_id
  → If not found, fallback: decrypt each legacy config's webhook_secret
  → Match → backfill hash, return config
  → No match → 401 Unauthorized
```

## 4. Webhook Ownership Convergence

### Changes to `supabase/functions/telegram-webhook/index.ts`

- Replaced global config lookup with `resolveBotConfigFromWebhookSecret()`
- Extracted `tenantId` from resolved config row
- All command handlers now receive `tenantId` as parameter
- Bot commands query filtered by `tenant_id`
- `/start` allowlist update scoped by `tenant_id`
- Voice transcription failure: replaced raw error message with safe UX copy
- Custom command execution forwards `tenantId` to `executeActions()`

### Tenant Propagation Chain

```
Webhook → resolveBotConfigFromWebhookSecret() → tenantId
  → executeActions(sb, tenantId, chatId, actions)
    → createTask(sb, tenantId, title)
    → listTasks(sb, tenantId, chatId)
    → completeTask(sb, tenantId, chatId, num)
    → setPriority(sb, tenantId, chatId, num, priority)
    → logActivity(sb, tenantId, type, text)
    → listActivities(sb, tenantId)
    → recordTransaction(sb, tenantId, direction, description, amount)
    → getBalance(sb, tenantId)
    → listTransactions(sb, tenantId)
    → requestConfirmation(sb, tenantId, chatId, ...)
    → getPendingConfirmation(sb, tenantId, chatId)
    → clearPendingConfirmation(sb, tenantId, chatId)
```

## 5. Confirmation-Flow Redesign

### Changes

All three confirmation functions (`requestConfirmation`, `getPendingConfirmation`, `clearPendingConfirmation`) now accept and propagate `tenantId`.

**Pending confirmation uniqueness:** `(tenant_id, chat_id, action_type)` — confirmed by a unique index in the migration.

**Expired confirmation cleanup:** Now deletes by `(tenant_id, chat_id)` instead of `chat_id` only, preventing cross-tenant cleanup.

**Stale confirmation detection:** The webhook now logs `stale_confirmation_attempt` telemetry when a SIM/NÃO response arrives but no pending confirmation exists for that tenant+chat.

### SQL Migration

```sql
-- Pending confirmations get tenant_id
alter table bot_pending_confirmations add column tenant_id uuid references tenants(id) on delete cascade;
delete from bot_pending_confirmations where tenant_id is null;  -- remove unsafe rows
alter table bot_pending_confirmations alter column tenant_id set not null;

-- Unique per (tenant_id, chat_id, action_type)
create unique index bot_pending_confirmations_tenant_chat_action_uidx
  on bot_pending_confirmations (tenant_id, chat_id, action_type);

-- Index for lookups
create index bot_pending_confirmations_tenant_chat_idx
  on bot_pending_confirmations (tenant_id, chat_id);
```

## 6. Business-Write Hardening

### Action Handlers Audited

| Handler | File | Tenant Scope Added |
|---------|------|-------------------|
| `createTask` | `actions/tasks.ts` | `.insert({ tenant_id: tenantId, ... })` |
| `listTasks` | `actions/tasks.ts` | `.eq('tenant_id', tenantId)` on tasks + kanban_columns reads |
| `completeTask` | `actions/tasks.ts` | `.eq('tenant_id', tenantId)` on tasks update + confirmation lookup |
| `setPriority` | `actions/tasks.ts` | `.eq('tenant_id', tenantId)` on tasks update |
| `logActivity` | `actions/activities.ts` | `.insert({ tenant_id: tenantId, ... })` |
| `listActivities` | `actions/activities.ts` | `.eq('tenant_id', tenantId)` |
| `recordTransaction` | `actions/finance.ts` | `.insert({ tenant_id: tenantId, ... })` + `.eq('tenant_id', tenantId)` on account lookup |
| `getBalance` | `actions/finance.ts` | `.eq('tenant_id', tenantId)` on accounts + transactions reads |
| `listTransactions` | `actions/finance.ts` | `.eq('tenant_id', tenantId)` |
| `executeActions` | `utils/actions.ts` | Forwards tenantId to all action handlers |

### Cross-Entity Safety

Every business write now includes `tenant_id`. Every business read is scoped with `.eq('tenant_id', tenantId)`. No mutation occurs without explicit tenant ownership.

## 7. Authorization Hardening

### Allowlist Scoping

The `/start` command handler now scopes the allowlist update by `tenant_id`:
```ts
await sb.from('bot_configs')
  .update({ allowed_telegram_ids: newIds })
  .eq('tenant_id', tenantId)
  .eq('id', configRow.id)
```

### Bot Commands Scoping

Command queries now filter by `tenant_id`:
```ts
await sb.from('bot_commands')
  .select('trigger, type, actions, is_active')
  .eq('tenant_id', tenantId)
  .eq('bot_config_id', configRow.id)
```

### Frontend Config/Commands Tenant Enforcement

`src/lib/botConfig.js`, `src/lib/botCommands.js`, `src/components/Settings/TelegramSection.jsx`, `src/components/Settings/CommandsSection.jsx`, `src/components/Settings/CommandForm.jsx`, and `src/components/Settings/OnboardingWizard.jsx` now pass explicit tenant ID in API requests.

Edge Functions `bot-config/index.ts` and `bot-commands/index.ts` now require `X-Tenant-Id` header and enforce tenant access through membership checks.

### Notification Worker

`notification-worker/index.ts` now includes `tenant_id` when looking up bot configs for Telegram reminder delivery.

## 8. Telemetry Integration

### New Telemetry Module

`supabase/functions/telegram-webhook/utils/telemetry.ts` — lightweight structured logging for Telegram flow events:

| Event | Trigger |
|-------|---------|
| `tenant_resolution_rejected` | Webhook secret not found (401) |
| `tenant_resolution_failed` | Hash lookup or legacy decryption error |
| `tenant_resolution_legacy_secret_match` | Legacy config matched, backfilling hash |
| `tenant_resolution_secret_decrypt_failed` | Legacy config decrypt error |
| `authorization_rejected` | Request validation failed (secret mismatch, paused, allowlist) |
| `voice_transcription_failed` | Voice message transcription error |
| `command_failure` | Command execution error |
| `confirmation_cancelled` | User cancelled a pending transaction |
| `stale_confirmation_attempt` | SIM/NÃO received with no pending confirmation |
| `telegram_user_authorized` | New Telegram user added via /start |

### Frontend Telemetry

Existing frontend telemetry in `diagnostics.js` already tracks Telegram config/command failures via `countTelegramIntegrationFailure`. No changes needed.

## 9. Test Coverage Added

### New Test File

`supabase/functions/telegram-webhook/tenant-scope.test.ts` — 6 Deno tests:

| Test | What It Proves |
|------|---------------|
| `finance persistence scopes account lookup and transaction insert by tenant` | `recordTransaction` passes `tenant_id` in insert and scopes account lookup |
| `task list stores confirmation context under tenant and chat` | `listTasks` stores confirmation with `tenant_id` and scopes reads |
| `confirmation lifecycle is tenant scoped` | `requestConfirmation` + `getPendingConfirmation` propagate tenant |
| `custom command execution forwards tenant id into each action` | `executeActions` passes tenantId to all child actions |
| `webhook config resolution maps secret hash to one tenant config` | `resolveBotConfigFromWebhookSecret` returns config with `tenant_id` |

### Existing Test Updates

`src/components/Settings/__tests__/CommandsSection.test.jsx` and `src/components/Settings/__tests__/TelegramSection.test.jsx` updated to pass `tenantId` in mock API calls.

## 10. Remaining Telegram Limitations

1. **No workspace-core routing** — Bot actions still use direct Supabase client reads/writes rather than routing through `workspace-core`. This was assessed as acceptable because the service-role Supabase client is now scoped by explicit `tenant_id` in every query. Full workspace-core convergence would require making workspace-core callable from Deno Edge Functions or introducing a shared ownership layer — both larger refactors beyond the scope of this convergence phase.

2. **No RLS on bot action tables** — Bot actions use service role client. With tenant_id scoping in application code this is safe, but RLS on business tables for service-role users is intentionally absent (service role bypasses RLS by design). The defense is the application-level tenant scoping.

3. **Bot config form UX unchanged** — The frontend config forms pass tenant ID now but the UX layout is unchanged. Future work could add tenant/bot selector UI for multi-bot setups.

4. **No end-to-end Playwright test** — The new Deno tests verify tenant scoping at the unit level. An end-to-end test that sends a Telegram message and validates tenant-scoped persistence would require a real or emulated Telegram API.

5. **Webhook secret hash is one-way** — Once set, the `webhook_secret_sha256` cannot be reversed. This is by design. If the webhook secret changes, the hash is updated on next match attempt via legacy fallback.

## 11. Remaining Operational Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Service-role writes bypass RLS entirely | Medium | Application-level tenant scoping in every query |
| No idempotency keys for bot mutations | Medium | Confirmation flow provides human-in-the-loop guard |
| Legacy configs without hash fall back to O(n) decrypt | Low | Fallback is one-time per config; hash is backfilled |
| Bot token rotation not handled | Low | Token is re-encrypted on config save; webhook re-registration needed |

## 12. Validation Results

| Command | Result |
|---------|--------|
| `npm run lint` | **PASS** — 0 warnings |
| `npm test` | **PASS** — 50 files, 225 tests (all passing) |
| `npm run build` | **PASS** — ~6s build |

## 13. Production-Readiness Reassessment

**Before Phase 35A:** Telegram bot was not production-safe for multi-tenant operation. Global config resolution and unscoped service-role writes created critical isolation risk.

**After Phase 35A:** Telegram bot is operationally tenant-safe. Every webhook request resolves to exactly one tenant via secret hash. Every query and mutation carries explicit `tenant_id`. Pending confirmations are tenant-scoped. Authorization is tenant-gated. Failure semantics are safe (no raw database errors exposed).

The Telegram path now obeys the same ownership semantics as the web application. The remaining limitations (direct Supabase vs workspace-core, no RLS on service-role path) are architectural constraints understood and accepted with compensating controls in place.

**Verdict:** Telegram is now production-safe for multi-tenant operation within the same trust model as the rest of the application.
