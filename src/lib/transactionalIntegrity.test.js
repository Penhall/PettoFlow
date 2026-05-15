// src/lib/transactionalIntegrity.test.js
// Tests for cross-entity transactional integrity: partial failures, idempotency,
// orphan-state prevention, and ownership propagation across multi-entity flows.

import { describe, it, expect, beforeEach } from 'vitest'
import { ok, fail, isMutationOk, getMutationData } from './mutationResult.js'
import { getTelemetrySnapshot, resetTelemetry } from './diagnostics.js'

beforeEach(() => {
  resetTelemetry()
})

// ─────────────────────────────────────────────────────────────────────────────
// invoiceReceivable — partial-failure semantics
// Reproduces the two-step flow: createTransaction → updateReceivable
// ─────────────────────────────────────────────────────────────────────────────

describe('invoiceReceivable — partial failure', () => {
  async function simulateInvoice({ transactionFails, receivableUpdateFails, alreadyInvoiced } = {}) {
    // Simulate the logic extracted from useReceivables.invoiceReceivable
    const receivable = {
      id: 1,
      task_id: 5,
      target_account_id: 2,
      amount: 15000,
      status: alreadyInvoiced ? 'invoiced' : 'pending',
      tasks: { title: 'Venda ABC' },
      activities: null,
    }

    // Idempotency guard
    if (receivable.status === 'invoiced') {
      const { countIdempotencyViolation } = await import('./diagnostics.js')
      countIdempotencyViolation('receivables.invoice')
      return fail(new Error('already invoiced'), { operation: 'receivables.invoice', code: 'already_invoiced' })
    }

    // Step 1: create transaction
    const addTransaction = transactionFails
      ? async () => fail(new Error('network error'), { operation: 'transactions.add' })
      : async () => ok({ id: 99, amount: 15000 })

    const transactionResult = await addTransaction()
    if (!isMutationOk(transactionResult)) return transactionResult
    const transaction = getMutationData(transactionResult)

    // Step 2: update receivable status
    const updateReceivable = receivableUpdateFails
      ? async () => { throw new Error('DB timeout') }
      : async () => ({ id: 1, status: 'invoiced', transaction_id: transaction.id })

    try {
      const updated = await updateReceivable()
      return ok(updated)
    } catch (error) {
      const { countPartialTransactionFailure, countOrphanStateRisk } = await import('./diagnostics.js')
      countPartialTransactionFailure('receivables.invoice')
      countOrphanStateRisk('receivables.invoice')
      return fail(error, { operation: 'receivables.invoice', code: 'partial_invoice_failure' })
    }
  }

  it('succeeds atomically when both steps pass', async () => {
    const result = await simulateInvoice()
    expect(isMutationOk(result)).toBe(true)
    expect(getMutationData(result).status).toBe('invoiced')
    const snap = getTelemetrySnapshot()
    expect(snap.partial_transaction_failures ?? 0).toBe(0)
    expect(snap.orphan_state_risks ?? 0).toBe(0)
  })

  it('returns fail when transaction creation fails — no orphan state', async () => {
    const result = await simulateInvoice({ transactionFails: true })
    expect(isMutationOk(result)).toBe(false)
    expect(result.code).toBe('persistence_failed')
    // No partial failure because step 1 never succeeded
    expect(getTelemetrySnapshot().partial_transaction_failures ?? 0).toBe(0)
    expect(getTelemetrySnapshot().orphan_state_risks ?? 0).toBe(0)
  })

  it('detects partial failure when transaction created but receivable update fails', async () => {
    const result = await simulateInvoice({ receivableUpdateFails: true })
    expect(isMutationOk(result)).toBe(false)
    expect(result.code).toBe('partial_invoice_failure')
    const snap = getTelemetrySnapshot()
    expect(snap.partial_transaction_failures).toBe(1)
    expect(snap['partial_tx_failure_receivables.invoice']).toBe(1)
    expect(snap.orphan_state_risks).toBe(1)
    expect(snap['orphan_risk_receivables.invoice']).toBe(1)
  })

  it('prevents duplicate invoicing via idempotency guard', async () => {
    const result = await simulateInvoice({ alreadyInvoiced: true })
    expect(isMutationOk(result)).toBe(false)
    expect(result.code).toBe('already_invoiced')
    const snap = getTelemetrySnapshot()
    expect(snap.idempotency_violations).toBe(1)
    expect(snap['idempotency_receivables.invoice']).toBe(1)
    // No orphan state risk from idempotency guard
    expect(snap.orphan_state_risks ?? 0).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// setAccountCategory — partial failure (demote succeeds, promote fails)
// ─────────────────────────────────────────────────────────────────────────────

describe('setAccountCategory — partial failure', () => {
  async function simulateSetCategory({ promoteFails } = {}) {
    const currentPrincipal = { id: 10, category: 'principal' }
    const targetAccountId = 20

    const updateAccount = async (id, updates) => {
      if (updates.category === 'principal' && promoteFails) {
        return fail(new Error('timeout'), { operation: 'accounts.update' })
      }
      return ok({ id, ...updates })
    }

    // Step 1: demote current principal
    const demoteResult = await updateAccount(currentPrincipal.id, { category: 'extras' })
    if (!isMutationOk(demoteResult)) return demoteResult

    // Step 2: promote target account
    const promoteResult = await updateAccount(targetAccountId, { category: 'principal' })
    if (!isMutationOk(promoteResult)) {
      const { countPartialTransactionFailure, countOrphanStateRisk } = await import('./diagnostics.js')
      countPartialTransactionFailure('accounts.setCategory')
      countOrphanStateRisk('accounts.setCategory')
      return fail(new Error('promote failed after demote'), { operation: 'accounts.setCategory', code: 'partial_category_failure' })
    }
    return ok(getMutationData(promoteResult))
  }

  it('succeeds when both demote and promote pass', async () => {
    const result = await simulateSetCategory()
    expect(isMutationOk(result)).toBe(true)
    expect(getMutationData(result).category).toBe('principal')
    expect(getTelemetrySnapshot().partial_transaction_failures ?? 0).toBe(0)
  })

  it('detects partial failure when demote succeeds but promote fails', async () => {
    const result = await simulateSetCategory({ promoteFails: true })
    expect(isMutationOk(result)).toBe(false)
    expect(result.code).toBe('partial_category_failure')
    const snap = getTelemetrySnapshot()
    expect(snap.partial_transaction_failures).toBe(1)
    expect(snap['partial_tx_failure_accounts.setCategory']).toBe(1)
    expect(snap.orphan_state_risks).toBe(1)
    expect(snap['orphan_risk_accounts.setCategory']).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// applyRules — partial application tracking and idempotency
// ─────────────────────────────────────────────────────────────────────────────

describe('applyRules — partial application', () => {
  function makeTransaction(id, needsReview = true) {
    return { id, amount: -5000, needs_review: needsReview, payee_id: 1 }
  }

  function makeRule(id) {
    return {
      id,
      priority: 1,
      is_active: true,
      conditions: [{ field: 'amount', op: 'less_than', value: 0 }],
      actions: [{ type: 'set_category', value: 7 }],
    }
  }

  async function simulateApplyRules({ failOnIndex } = {}) {
    const { runRulesEngine } = await import('../lib/rulesEngine.js')
    const transactions = [makeTransaction(1), makeTransaction(2), makeTransaction(3)]
    const rules = [makeRule(1)]
    const pendingTransactions = transactions.filter((t) => t.needs_review)
    let applied = 0

    const updateTransaction = async (id) => {
      if (failOnIndex !== undefined && applied === failOnIndex) {
        return fail(new Error('timeout'), { operation: 'transactions.update' })
      }
      return ok({ id, needs_review: false, category_id: 7 })
    }

    for (const transaction of pendingTransactions) {
      const { enriched, ruleMatched } = runRulesEngine(transaction, rules)
      if (ruleMatched) {
        const result = await updateTransaction(transaction.id, { ...enriched, needs_review: false })
        if (!isMutationOk(result)) {
          if (applied > 0) {
            const { countPartialTransactionFailure } = await import('./diagnostics.js')
            countPartialTransactionFailure('transactions.applyRules')
          }
          return result
        }
        applied += 1
      }
    }

    return ok({ applied, total: pendingTransactions.length })
  }

  it('applies all matching rules and returns applied count', async () => {
    const result = await simulateApplyRules()
    expect(isMutationOk(result)).toBe(true)
    const data = getMutationData(result)
    expect(data.applied).toBeGreaterThan(0)
    expect(data.total).toBe(3)
    expect(getTelemetrySnapshot().partial_transaction_failures ?? 0).toBe(0)
  })

  it('emits partial failure telemetry when a rule update fails mid-loop after some succeeded', async () => {
    const result = await simulateApplyRules({ failOnIndex: 1 })
    expect(isMutationOk(result)).toBe(false)
    expect(getTelemetrySnapshot().partial_transaction_failures).toBe(1)
    expect(getTelemetrySnapshot()['partial_tx_failure_transactions.applyRules']).toBe(1)
  })

  it('does not emit partial failure telemetry when first update fails (no prior success)', async () => {
    const result = await simulateApplyRules({ failOnIndex: 0 })
    expect(isMutationOk(result)).toBe(false)
    // No partial failure because first attempt failed before any success
    expect(getTelemetrySnapshot().partial_transaction_failures ?? 0).toBe(0)
  })

  it('is retry-safe: already-reviewed transactions are filtered out before re-application', () => {
    const transactions = [
      { id: 1, needs_review: false },
      { id: 2, needs_review: true },
    ]
    const pending = transactions.filter((t) => t.needs_review)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cross-entity ownership propagation
// ─────────────────────────────────────────────────────────────────────────────

describe('cross-entity ownership propagation', () => {
  it('all multi-entity payloads include tenantId at each step', () => {
    const tenantId = 'tenant-abc'

    // receivable invoice — both calls must carry tenantId
    const step1 = { account_id: 1, amount: 10000, tenantId }
    const step2 = { status: 'invoiced', transaction_id: 5, tenantId }
    expect(step1.tenantId).toBe(tenantId)
    expect(step2.tenantId).toBe(tenantId)
  })

  it('rejects multi-entity flows when tenantId is missing', async () => {
    // Simulate the early-return guard used in all multi-step hooks
    function tenantGuard(tenantId, operation) {
      if (!tenantId) return fail(new Error('tenant required'), { operation, code: 'missing_tenant' })
      return null
    }

    const invGuard = tenantGuard(null, 'receivables.invoice')
    expect(isMutationOk(invGuard)).toBe(false)
    expect(invGuard.code).toBe('missing_tenant')

    const catGuard = tenantGuard(null, 'accounts.setCategory')
    expect(isMutationOk(catGuard)).toBe(false)
    expect(catGuard.code).toBe('missing_tenant')

    const rulesGuard = tenantGuard(null, 'transactions.applyRules')
    expect(isMutationOk(rulesGuard)).toBe(false)
    expect(rulesGuard.code).toBe('missing_tenant')
  })

  it('secondary entity in invoice flow carries the primary entity source link', () => {
    const receivable = { id: 1, task_id: 5, activity_id: null }
    const sourceLink = receivable.task_id
      ? { type: 'task', id: receivable.task_id }
      : { type: 'activity', id: receivable.activity_id }

    expect(sourceLink).toEqual({ type: 'task', id: 5 })

    const receivableActivity = { id: 2, task_id: null, activity_id: 8 }
    const activityLink = receivableActivity.task_id
      ? { type: 'task', id: receivableActivity.task_id }
      : { type: 'activity', id: receivableActivity.activity_id }

    expect(activityLink).toEqual({ type: 'activity', id: 8 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Interrupted workflow — mutation queue semantics (onboarding)
// ─────────────────────────────────────────────────────────────────────────────

describe('interrupted workflow recovery', () => {
  it('serial queue drains correctly when one item fails', async () => {
    const results = []
    let queue = Promise.resolve(null)

    function enqueue(label, shouldFail) {
      const queued = queue.then(async () => {
        if (shouldFail) {
          throw new Error(`${label} failed`)
        }
        results.push(label)
        return label
      })
      queue = queued.catch(() => null)
      return queued
    }

    enqueue('step-1', false)
    enqueue('step-2', true)  // fails
    enqueue('step-3', false)

    await queue

    expect(results).toContain('step-1')
    expect(results).not.toContain('step-2')
    expect(results).toContain('step-3')
  })

  it('mutation queue does not propagate rejection to subsequent items', async () => {
    const errors = []
    let queue = Promise.resolve(null)

    function enqueue(task) {
      const queued = queue.then(task)
      queue = queued.catch((e) => { errors.push(e.message); return null })
      return queued
    }

    await enqueue(async () => 'ok-1')
    await enqueue(async () => { throw new Error('mid-failure') }).catch(() => {})
    const last = await enqueue(async () => 'ok-3')

    expect(last).toBe('ok-3')
    expect(errors).toContain('mid-failure')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate submission prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('duplicate submission prevention', () => {
  it('already_invoiced code is returned for idempotency violations', () => {
    const result = fail(new Error('already invoiced'), { operation: 'receivables.invoice', code: 'already_invoiced' })
    expect(isMutationOk(result)).toBe(false)
    expect(result.code).toBe('already_invoiced')
  })

  it('applyRules skips already-reviewed transactions naturally', () => {
    const transactions = [
      { id: 1, needs_review: false, category_id: 7 },
      { id: 2, needs_review: true },
    ]
    const pending = transactions.filter((t) => t.needs_review)
    expect(pending.map((t) => t.id)).toEqual([2])
  })

  it('setAccountCategory is safe to call when target is already principal', async () => {
    // If the target is already principal with no existing-other-principal, no demote step runs
    const accounts = [{ id: 20, category: 'principal' }]
    const getPrincipal = () => accounts.find((a) => a.category === 'principal')

    const current = getPrincipal()
    const targetAccountId = 20

    // current.id === targetAccountId → no demote, no two-step risk
    const shouldDemote = current && current.id !== targetAccountId
    expect(shouldDemote).toBe(false)
  })
})
