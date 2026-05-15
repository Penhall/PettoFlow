# Operational Readiness Checklist

## NexusCRM — Controlled Real-User Rollout

Use this checklist before and during controlled real-user deployment. Each section must be verified before proceeding to the next rollout phase.

---

## 1. Environment Validation

- [ ] `.env` variables loaded correctly on all environments
- [ ] `VITE_SUPABASE_URL` points to production Supabase project
- [ ] `VITE_SUPABASE_ANON_KEY` is the production key (public)
- [ ] Stripe keys configured for test/production mode
- [ ] Telegram bot token configured
- [ ] Vercel environment variables match production
- [ ] Rate limits configured appropriately

## 2. Supabase Validation

- [ ] All migrations applied (`supabase/migrations/`) up to latest
- [ ] RLS policies active on all business tables
- [ ] `bot_pending_confirmations.tenant_id` migration applied (35A)
- [ ] Service role functions reviewed for tenant scoping
- [ ] Storage bucket policies in place
- [ ] Backup strategy confirmed

## 3. Edge Function Validation

- [ ] `workspace-core` deployed and responding
- [ ] `tenant-core` deployed and responding
- [ ] `admin-core` deployed and responding
- [ ] `invite-member` deployed and responding
- [ ] `bot-config` deployed with tenant scoping (35A)
- [ ] `bot-commands` deployed with tenant scoping (35A)
- [ ] `telegram-webhook` deployed with secret hash resolution (35A)
- [ ] `notification-worker` deployed
- [ ] `stripe-webhook` deployed (if billing active)

## 4. Telegram Validation

- [ ] `webhook_secret_sha256` column present in `bot_configs` (35A)
- [ ] Webhook secret mapping resolves to correct tenant (35A)
- [ ] All action handlers scope reads by `tenant_id` (35A)
- [ ] All action handlers include `tenant_id` in inserts (35A)
- [ ] `getPendingConfirmation` expiry does not delete `task_list_context` (35A fix)
- [ ] `bot.start` handles null `allowed_telegram_ids` (35A fix)

## 5. Onboarding Validation

- [ ] Tenant creation seeds starter data
- [ ] Onboarding state persists per `(tenant_id, user_id)`
- [ ] Onboarding events logged
- [ ] Failed onboarding shows recovery prompt (36C)
- [ ] Onboarding retry path works (36A)

## 6. Ownership Validation

- [ ] `workspaceCoreRequest` passes `X-Tenant-Id` header
- [ ] All domain hooks pass explicit `tenantId`
- [ ] Mutation results use `{ ok, data, error, code }` (35B)
- [ ] Read results distinguish success/empty/failed/stale (36A)
- [ ] Partial failure detection active in multi-entity flows (36B)

## 7. Telemetry Validation

- [ ] Diagnostics counters active in `diagnostics.js`
- [ ] Read-path counters active (36A)
- [ ] Transactional integrity counters active (36B)
- [ ] Diagnostics Panel accessible to operators (36C)
- [ ] Feature flag overrides work via localStorage (36C)

## 8. Rollback Procedures

- [ ] Git tag recorded for current deployment commit
- [ ] Supabase snapshot/Database export available
- [ ] Previous migration rollback SQL documented
- [ ] Feature flag to disable new flows without redeployment
- [ ] Communication plan for affected users documented

## 9. Recovery Procedures

| Scenario | Recovery Action |
|----------|----------------|
| Onboarding load failure | Retry from error state; if persists, clear localStorage and reload |
| Save failure | Error message with retry button; if persists, check diagnostics panel |
| Partial invoice failure | Check `partial_transaction_failures` counter; manually reconcile if needed |
| Stale session | Log out and re-authenticate |
| Tenant mismatch | Switch workspace or log out and re-authenticate |
| Telegram webhook failure | Check `telegram_failures` counter; re-register webhook |

## 10. First-User Support Guidance

- Monitor diagnostics panel for non-zero critical counters
- Watch `mutation_failures`, `partial_transaction_failures`, `read_unauthorized`
- Check event buffer for unexpected error events
- Test onboarding path with each new tenant manually until proven stable
- Document any user-reported issues and correlate with telemetry
