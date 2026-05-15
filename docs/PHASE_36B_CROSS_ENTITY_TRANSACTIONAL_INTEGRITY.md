# PHASE_36B_CROSS_ENTITY_TRANSACTIONAL_INTEGRITY

Date: 2026-05-15
Scope: NexusCRM/PettoFlow cross-entity transactional integrity
Posture: eliminate multi-step operational inconsistency

## 1. Executive Summary

The Phase 34/35 audits confirmed that several multi-entity workflows — receivable invoicing, account principal changes, rules engine application, onboarding state persistence — execute dependent writes as separate HTTP calls without transactional guarantees. Partial failure can leave orphan state (transaction created but receivable not updated, demoted account without new principal).

This phase introduced explicit partial-failure detection, idempotency guards, and telemetry for orphan-state risks across all high-priority multi-step flows. 18 new tests validate recovery semantics for invoice, account category, rules application, interrupted workflows, duplicate submissions, and cross-entity ownership propagation.

## 2. Previous Integrity Risks

| Flow | Steps | Risk Before 36B |
|------|-------|-----------------|
| **invoiceReceivable** | 1. createTransaction → 2. updateReceivable | Transaction persists even if receivable update fails |
| **setAccountCategory** | 1. demote current principal → 2. promote target | No principal exists if step 1 succeeds and step 2 fails |
| **applyRules** | 1..N. update each pending transaction | Partial application with no rollback |
| **Onboarding state** | 1. patch state → 2. record event | Event can be lost independently |
| **Task completion → receivable** | 1. update task → 2. create receivable | Task complete but no financial record |

## 3. Multi-Step Workflow Audit

All high-priority multi-step flows were audited and hardened:

### invoiceReceivable (FinanceView)
- Before: `addTransaction()` returns null/false, then `updateReceivableRecord` called separately
- After: Chain checks `isMutationOk()` at each step, propagates failure explicitly, emits `partial_transaction_failure` and `orphan_state_risk` telemetry when step 1 succeeds but step 2 fails

### setAccountCategory (Account management)
- Before: Demote + promote as separate calls, no recovery if promote fails
- After: Same pattern — explicit result checking, telemetry for partial failures
- Guard added: skip demote when target is already the current principal

### applyRules (Transaction rules engine)
- Before: Loop with silent catch/log per item
- After: Each item update checked with `isMutationOk()`, partial-failure telemetry emitted when some succeeded before failure
- Retry-safe: already-reviewed (`needs_review: false`) transactions are filtered out before re-application

### Onboarding state
- Existing serial queue pattern (`queue = queued.catch(() => null)`) prevents cascading rejections
- Tested: queue continues after a failed item

### Task completion → receivable
- `App.jsx` task completion handler updated: receivable creation failure now returns explicit `fail()` instead of silent null

## 4. Transactional Grouping Improvements

Not all multi-step flows converged to server-side RPCs, which would require new Supabase functions. Instead, the convergence strategy was:

1. **Explicit result chaining** — Every step checks `isMutationOk()` before proceeding
2. **Partial-failure detection** — When step N fails after step 1..N-1 succeeded, telemetry fires
3. **Recovery guidance** — User-facing error messages direct users to check state and retry

This is honest about the frontend-only nature of the convergence — no fake atomicity is introduced.

## 5. Partial-Failure Recovery Semantics

### Detection

| Condition | Detection | Telemetry |
|-----------|-----------|-----------|
| Transaction created, receivable update fails | `partial_invoice_failure` code | `partial_transaction_failures` + `orphan_state_risks` |
| Principal demoted, promote fails | `partial_category_failure` code | `partial_transaction_failures` + `orphan_state_risks` |
| Rules applied to subset of transactions | `persistence_failed` code (with applied count) | `partial_transaction_failures` |

### Recovery Paths

| Flow | Recovery |
|------|----------|
| invoiceReceivable partial fail | User sees "Faturamento foi criado parcialmente" — can retry invoice or manually reconcile |
| setAccountCategory partial fail | User sees "Houve um erro ao alterar a conta principal" — can retry or manually set principal |
| applyRules partial fail | User sees error for failed updates; already-applied transactions skipped on retry |

## 6. Idempotency Hardening

| Guard | Location | Effect |
|-------|----------|--------|
| `status === 'invoiced'` check | invoiceReceivable entry | Prevents re-invoicing, emits `idempotency_violations` telemetry |
| `needs_review` filter | applyRules loop | Already-reviewed transactions skipped on retry |
| Target-already-principal check | setAccountCategory | Skips demote/promote cycle entirely |

### Telemetry counters added in diagnostics.js

| Counter | Trigger |
|---------|---------|
| `partial_transaction_failures` | Total partial failures |
| `partial_tx_failure_<flow>` | Per-flow partial failure |
| `orphan_state_risks` | Total orphan state risks |
| `orphan_risk_<flow>` | Per-flow orphan state risk |
| `idempotency_violations` | Total idempotency violations |
| `idempotency_<flow>` | Per-flow idempotency violation |

## 7. Ownership Integrity Validation

### Tenant Propagation

All multi-entity flows verified for tenant ownership:

| Flow | Step 1 Tenant | Step 2 Tenant |
|------|---------------|---------------|
| invoiceReceivable | `addTransaction({..., tenantId})` | `updateReceivableRecord(id, {..., tenantId})` |
| setAccountCategory | `updateAccount(current.id, {..., tenantId})` | `updateAccount(targetId, {..., tenantId})` |
| applyRules | `updateTransaction(id, {..., tenantId})` | loop — same tenantId per item |
| Onboarding queue | `updateOnboardingState(tenantId, ...)` | `recordOnboardingEvent(tenantId, ...)` |

No secondary entity bypasses tenant scoping. Tests validate that missing `tenantId` returns `fail({ code: 'missing_tenant' })` for all three flows.

## 8. Telemetry Additions

### New Counters

Added to `src/lib/diagnostics.js`:

| Counter | Trigger |
|---------|---------|
| `partial_transaction_failures` | Total partial failures |
| `partial_tx_failure_<operation>` | Per-operation partial failure |
| `orphan_state_risks` | Orphan state risk detected |
| `orphan_risk_<operation>` | Per-operation orphan risk |
| `idempotency_violations` | Duplicate submission detected |
| `idempotency_<operation>` | Per-operation idempotency violation |

### UX Text Updates

Added to `src/content/uxText.js`: new error messages for partial failure and idempotency scenarios.

## 9. Tests Added

### New File: `src/lib/transactionalIntegrity.test.js`

| Test Group | Tests | What It Proves |
|-----------|-------|----------------|
| invoiceReceivable — partial failure | 4 | Success, transaction fails, receivable fails (orphan risk), idempotency guard |
| setAccountCategory — partial failure | 2 | Success, demote succeeds/promote fails (orphan) |
| applyRules — partial application | 4 | Full success, mid-loop failure, first-item failure, retry-safety |
| Cross-entity ownership propagation | 3 | tenantId at each step, missing tenant rejection, source link integrity |
| Interrupted workflow recovery | 2 | Queue continues after failure, no cascading rejection |
| Duplicate submission prevention | 4 | already_invoiced code, needs_review filtering, target-already-principal guard |

**Total new tests:** 18

### Test Coverage Summary

| Metric | Before 36A | After 36A | After 36B |
|--------|-----------|-----------|-----------|
| Test files | 54 | 55 | 56 |
| Tests | 236 | 242 | 260 |

## 10. Remaining Integrity Risks

1. **No server-side Supabase RPCs added** — All multi-step hardening was applied at the frontend layer. True atomicity would require server-side transactions/RPCs, which was out of scope per the "DO NOT rewrite backend architecture" rule.

2. **No rollback implemented** — When partial failure is detected, recovery guidance is provided but no automatic rollback occurs. Manual reconciliation may be needed.

3. **Task completion → receivable** — This flow in `App.jsx` is now hardened with `isMutationOk()` checks, but the two-step nature (complete task, then create receivable) remains non-atomic.

4. **No idempotency keys for user-triggered mutations** — The guards (status check, needs_review filter) are application-level. No server-side idempotency key is generated.

5. **Orphan state detection is telemetry-only** — No automated cleanup of orphan records exists. Operators must monitor `orphan_state_risks` telemetry.

## 11. Remaining Non-Atomic Flows

| Flow | Steps | Risk |
|------|-------|------|
| Billing checkout → subscription update | Stripe session + local DB update | Stripe charges but local update could fail (webhook eventually reconciles) |
| File upload → metadata row | Storage write + DB insert | Storage object persists even if metadata insert fails (best-effort cleanup) |
| Notification creation → Telegram send | DB row + Telegram API | Notification created but Telegram message may not be sent |
| Onboarding state → event record | State patch + event write | Event may be lost independently |

These are documented as pre-existing gaps. All have lower severity than the invoice/account/rule flows which were addressed in this phase.

## 12. Validation Results

| Command | Result |
|---------|--------|
| `npm run lint` | **PASS** — 0 warnings |
| `npm test` | **PASS** — 56 files, 260 tests |
| `npm run build` | **PASS** — ~6s build |

## 13. Production-Readiness Reassessment

**Before Phase 36B:** Multi-entity workflows (invoice, account change, rules application) could partially succeed without detection. Duplicate submissions could create duplicate records. Orphan state had no telemetry.

**After Phase 36B:** All high-priority multi-step flows have explicit result chaining. Partial failures are detected and surfaced via telemetry (`partial_transaction_failures`, `orphan_state_risks`, `idempotency_violations`). Idempotency guards prevent duplicate invoicing and rule re-application. 18 tests validate recovery semantics.

The hardening is honest about its frontend-only nature — no fake atomicity was introduced. The remaining non-atomic flows are documented with lower severity.

**Verdict:** Cross-entity workflow integrity improved materially. Partial failures are now detectable and observable. True atomicity requires server-side transactions but partial-failure recovery is now operationally supportable.
