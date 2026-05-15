# Controlled Rollout Guide

## NexusCRM — Phase 36C Controlled Real-User Rollout

---

## 1. Rollout Sequencing

### Phase 1 — Operator Validation (1-2 days)
1. Deploy all pending migrations to production Supabase
2. Deploy Edge Functions (workspace-core, tenant-core, admin-core, bot-config, bot-commands, telegram-webhook, notification-worker)
3. Deploy frontend to Vercel
4. Run diagnostics panel — verify all counters start at zero
5. Create first test tenant manually
6. Walk through full onboarding flow
7. Create task, log activity, record transaction, create client
8. Verify no error counters incremented

### Phase 2 — Controlled User Invitation (3-5 days)
1. Invite the user from `tester@nexuscrm.com` (existing test account)
2. Monitor diagnostics panel hourly during first sessions
3. Verify onboarding completes successfully
4. Verify Telegram config works for the test tenant
5. Check for stale-read detections or mutation failures
6. Confirm no orphan_state_risks incremented

### Phase 3 — Expanded Invitations (1-2 weeks)
1. Invite 2-3 trusted users from different tenants
2. Monitor critical counters daily
3. Collect user feedback on stability
4. Address any reported issues before expanding

### Phase 4 — Controlled Onboarding Flow (ongoing)
1. Enable self-service signup (if desired)
2. Monitor new-user onboarding funnel via counters:
   - `onboarding_completed` vs `onboarding_dropoff` ratio
   - `mutation_failures` during onboarding
   - `onboarding_retries`
3. Watch for pattern: any `read_interrupted` > 10 per user session signals UX issue

---

## 2. Operator Monitoring Guidance

### Dashboard
Access the Diagnostics Panel at `/admin/diagnostics` (admin role required).

### What to Watch For

| Counter | Threshold | Action |
|---------|-----------|--------|
| `onboarding_dropoff` | > 0 in a session | Investigate onboarding flow failure |
| `mutation_failures` | > 3 per user session | Check user's workflow for persistence issues |
| `partial_transaction_failures` | > 0 | Partial data loss — may need manual reconciliation |
| `orphan_state_risks` | > 0 | Orphan records may exist — investigate immediately |
| `read_unauthorized` | > 0 per tenant | Tenant isolation or auth issue |
| `telegram_failures` | > 3 per day | Bot execution concerns |
| `idempotency_violations` | > 3 per day | Users double-clicking or retry UX issue |

### Event Buffer
- Shows last 20 events with timestamps
- Filter by `kind` (read-path, orchestration, async-failure, mutation-result)
- Use to trace the sequence of events leading to an issue

### Feature Flags
Toggle at runtime via the Diagnostics Panel or localStorage:
```js
// Browser console
localStorage.setItem('nexus_flags', JSON.stringify({
  diagnostics_panel: true,
  destructive_action_confirm: true
}))
```

---

## 3. Known-Risk Flows

| Flow | Risk Level | Notes |
|------|-----------|-------|
| Billing checkout | **Medium** | Stripe integration depends on env config |
| Telegram bot setup | **Medium** | Requires correct webhook registration |
| File upload | **Low** | Two-phase write — orphan cleanup best-effort |
| Apply rules (finance) | **Low** | Non-atomic — partial application tracked via telemetry |
| Invoice receivable | **Low** | Non-atomic — partial failure detected and reported |
| Tenant switching | **Low** | Stale data possible during transition — stale-read detection active |

---

## 4. Rollback Procedures

### Frontend Rollback
```bash
# Revert to previous deployment
git revert HEAD --no-commit  # or target specific commit
git push origin main

# Or use Vercel rollback:
vercel rollback
```

### Database Rollback
```sql
-- Target specific migration rollback
-- Each migration in supabase/migrations/ should have a down.sql equivalent
-- If not, restore from Supabase backup
```

### Feature Flag Disable
```js
// Disable specific features without redeployment
localStorage.setItem('nexus_flags', JSON.stringify({
  diagnostics_panel: false,
  telegram_integration: false,
  finance_rules_engine: false,
}))
```

### Communication
- If a blocking issue is found: disable affected feature via flag, notify affected users, fix in next deployment
- If a data integrity issue is found: stop rollout, investigate, fix, restore from backup if needed

---

## 5. Telemetry Interpretation

### Key Metrics for Rollout Health

| Metric | Healthy Range | Unhealthy |
|--------|---------------|-----------|
| `mutation_failures` / user session | 0 | > 1 |
| `partial_transaction_failures` | 0 | > 0 |
| `orphan_state_risks` per day | 0 | > 0 |
| `read_failures` / user session | 0-1 (retry succeeds) | > 3 |
| `read_unauthorized` per day | 0 | > 0 |
| `onboarding_dropoff` / new user | 0 | > 0 |
| Read retry success rate | > 90% | < 80% |
| `onboarding_completed` / total onboarding attempts | > 90% | < 80% |

### Session-Level Monitoring

For each new user session during controlled rollout:
1. Check `read_failures` — should be 0 (fetches succeed on first or retry)
2. Check `mutation_failures` — should be 0 (all saves succeed)
3. Check `onboarding_dropoff` — should be 0 (onboarding completes)
4. Check `stale_mutation_rejections` — should be 0 (no stale data)

If any of these are non-zero for a user session, investigate immediately.

---

## 6. First-User Support Guidance

### Before First User
1. Run all tests: `npm test` (260+ tests should pass)
2. Verify lint: `npm run lint` (0 warnings)
3. Verify build: `npm run build`
4. Run visual tests if applicable: `npm run test:visual`
5. Check operational-readiness-checklist.md

### During First User Onboarding
1. Monitor diagnostics panel in real-time
2. Walk through with the user (screen share recommended)
3. Note any unexpected errors or UX friction
4. After session: review event buffer for anomalies

### Post-Session Review
1. Reset telemetry counters after each session
2. Review `read_stale`, `read_interrupted` for UX smoothness
3. Review `telegram_failures` if Telegram was configured
4. Document any user confusion points for UX improvement

### Escalation Path
1. **Minor issue (no data loss):** Log issue, fix in next deploy, inform user
2. **Data integrity issue (partial_failures):** Check orphan risk, reconcile data, fix root cause
3. **Isolation issue (read_unauthorized):** Stop rollout, investigate RLS/tenant scoping
4. **Critical issue (data loss):** Rollback, restore from backup, fix before re-deploying
