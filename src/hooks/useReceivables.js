import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listReceivableRecords,
  createReceivableRecord,
  updateReceivableRecord,
} from '../lib/workspaceCore'
import { fail, getMutationData, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'
import {
  countIdempotencyViolation,
  countOrphanStateRisk,
  countPartialTransactionFailure,
} from '../lib/diagnostics.js'

export function useReceivables({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  // getVisualFixture returns a new array reference every call; memoize so
  // the useCallback dep array stays stable and doesn't loop in visual mode.
  const fixtureReceivables = useMemo(() => getVisualFixture('receivables', []), [])
  const [receivables, setReceivables] = useState(visualMode ? fixtureReceivables : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? fixtureReceivables : []))
  const receivablesRef = useRef(receivables)

  useEffect(() => {
    receivablesRef.current = receivables
  }, [receivables])

  const fetch = useCallback(async () => {
    if (visualMode) {
      setReceivables(fixtureReceivables)
      setReadResult(readSuccess(fixtureReceivables))
      setLoading(false)
      return fixtureReceivables
    }

    if (!tenantId) {
      setReceivables([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return []
    }

    setLoading(true)
    const result = await runReadWithRetry('receivables.list', () => listReceivableRecords(tenantId), {
      previousData: receivablesRef.current,
      tenantId,
      onState: setReadResult,
    })
    if (result.ok) setReceivables(result.data || [])
    setLoading(false)
    return result.data || []
  }, [visualMode, fixtureReceivables, tenantId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createReceivable = async (taskId, amount, targetAccountId) => {
    if (visualMode) return ok({ task_id: taskId, amount, target_account_id: targetAccountId })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'receivables.create', code: 'missing_tenant' })

    return runMutation('receivables.create', async () => {
      const created = await createReceivableRecord({
        task_id: taskId,
        amount,
        target_account_id: targetAccountId,
        status: 'pending',
      }, tenantId)
      await fetch()
      return created
    })
  }

  const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
    if (visualMode) return ok({ activity_id: activityId, amount, target_account_id: targetAccountId, due_date: dueDate })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'receivables.createFromActivity', code: 'missing_tenant' })

    return runMutation('receivables.createFromActivity', async () => {
      const created = await createReceivableRecord({
        activity_id: activityId,
        amount,
        target_account_id: targetAccountId,
        status: 'pending',
        due_date: dueDate,
      }, tenantId)
      await fetch()
      return created
    })
  }

  const invoiceReceivable = async (receivableId, adjustedAmount, date, addTransaction) => {
    if (visualMode) {
      return ok(receivables.find((receivable) => receivable.id === receivableId) ?? { amount: adjustedAmount, date })
    }
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'receivables.invoice', code: 'missing_tenant' })

    const receivable = receivables.find((item) => item.id === receivableId)
    if (!receivable) return fail(new Error('receivable not found'), { operation: 'receivables.invoice', code: 'not_found' })

    // Idempotency guard: prevent double-invoicing the same receivable
    if (receivable.status === 'invoiced') {
      countIdempotencyViolation('receivables.invoice')
      return fail(new Error('receivable already invoiced'), { operation: 'receivables.invoice', code: 'already_invoiced' })
    }

    const sourceName = receivable.tasks?.title ?? receivable.activities?.title ?? 'lancamento'
    const sourceLink = receivable.task_id
      ? { type: 'task', id: receivable.task_id }
      : { type: 'activity', id: receivable.activity_id }

    // Step 1: create the transaction record
    const transactionResult = await addTransaction({
      account_id: receivable.target_account_id,
      amount: adjustedAmount,
      date,
      notes: `Faturamento: ${sourceName}`,
      related_to: [sourceLink],
    })
    if (!isMutationOk(transactionResult)) return transactionResult
    const transaction = getMutationData(transactionResult)

    // Step 2: mark receivable as invoiced — partial-failure risk if this fails
    // after step 1 already persisted the transaction.
    try {
      const updated = await updateReceivableRecord(receivableId, {
        status: 'invoiced',
        transaction_id: transaction.id,
        invoiced_at: new Date().toISOString(),
      }, tenantId)
      setReceivables((current) => current.map((item) => (item.id === receivableId ? { ...item, ...updated } : item)))
      return ok(updated)
    } catch (error) {
      // Transaction created (step 1) but receivable status not updated (step 2).
      // The receivable remains "pending" — a retry would attempt to create another transaction.
      // Telemetry surfaces this for operator investigation.
      countPartialTransactionFailure('receivables.invoice')
      countOrphanStateRisk('receivables.invoice')
      return fail(error, { operation: 'receivables.invoice', code: 'partial_invoice_failure' })
    }
  }

  const listReceivables = ({ status, taskId } = {}) =>
    receivables.filter((receivable) => {
      if (status && receivable.status !== status) return false
      if (taskId !== undefined && receivable.task_id !== taskId) return false
      return true
    })

  return {
    receivables,
    loading,
    readResult,
    readState: readResult.state,
    error: readResult.error,
    stale: readResult.stale,
    createReceivable,
    createReceivableFromActivity,
    invoiceReceivable,
    listReceivables,
    refresh: fetch,
  }
}
