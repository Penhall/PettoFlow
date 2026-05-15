import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listReceivableRecords,
  createReceivableRecord,
  updateReceivableRecord,
} from '../lib/workspaceCore'
import { fail, getMutationData, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useReceivables({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  // getVisualFixture returns a new array reference every call; memoize so
  // the useCallback dep array stays stable and doesn't loop in visual mode.
  const fixtureReceivables = useMemo(() => getVisualFixture('receivables', []), [])
  const [receivables, setReceivables] = useState(visualMode ? fixtureReceivables : [])
  const [loading, setLoading] = useState(!visualMode)

  const fetch = useCallback(async () => {
    if (visualMode) {
      setReceivables(fixtureReceivables)
      setLoading(false)
      return fixtureReceivables
    }

    if (!tenantId) {
      setReceivables([])
      setLoading(false)
      return []
    }

    setLoading(true)
    try {
      const data = await listReceivableRecords(tenantId)
      setReceivables(data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching receivables:', error)
      return []
    } finally {
      setLoading(false)
    }
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

    const sourceName = receivable.tasks?.title ?? receivable.activities?.title ?? 'lancamento'
    const sourceLink = receivable.task_id
      ? { type: 'task', id: receivable.task_id }
      : { type: 'activity', id: receivable.activity_id }

    const transactionResult = await addTransaction({
      account_id: receivable.target_account_id,
      amount: adjustedAmount,
      date,
      notes: `Faturamento: ${sourceName}`,
      related_to: [sourceLink],
    })
    if (!isMutationOk(transactionResult)) return transactionResult
    const transaction = getMutationData(transactionResult)

    return runMutation('receivables.invoice', async () => {
      const updated = await updateReceivableRecord(receivableId, {
        status: 'invoiced',
        transaction_id: transaction.id,
        invoiced_at: new Date().toISOString(),
      }, tenantId)
      setReceivables((current) => current.map((item) => (item.id === receivableId ? { ...item, ...updated } : item)))
      return updated
    })
  }

  const listReceivables = ({ status, taskId } = {}) =>
    receivables.filter((receivable) => {
      if (status && receivable.status !== status) return false
      if (taskId !== undefined && receivable.task_id !== taskId) return false
      return true
    })

  return { receivables, loading, createReceivable, createReceivableFromActivity, invoiceReceivable, listReceivables, refresh: fetch }
}
