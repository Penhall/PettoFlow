// src/hooks/useReceivables.js
import { useState, useEffect, useCallback } from 'react'
import {
  listReceivableRecords,
  createReceivableRecord,
  updateReceivableRecord,
} from '../lib/workspaceCore'

export function useReceivables() {
  const [receivables, setReceivables] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listReceivableRecords()
      setReceivables(data || [])
    } catch (error) {
      console.error('Error fetching receivables:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const createReceivable = async (taskId, amount, targetAccountId) => {
    try {
      const created = await createReceivableRecord({
        task_id: taskId,
        amount,
        target_account_id: targetAccountId,
        status: 'pending',
      })
      await fetch()
      return created
    } catch (error) {
      console.error('Error creating receivable:', error)
      return null
    }
  }

  /**
   * Creates a receivable originated from an activity.
   * @param {number} activityId
   * @param {number} amount - in cents
   * @param {number|null} targetAccountId
   * @param {string|null} dueDate - YYYY-MM-DD
   */
  const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
    try {
      const created = await createReceivableRecord({
        activity_id: activityId,
        amount,
        target_account_id: targetAccountId,
        status: 'pending',
        due_date: dueDate,
      })
      await fetch()
      return created
    } catch (error) {
      console.error('Error creating receivable from activity:', error)
      return null
    }
  }

  /**
   * Marks a receivable as invoiced and creates a real transaction.
   * Uses addTransaction from useTransactions for rules engine + needs_review logic.
   * @param {number} receivableId
   * @param {number} adjustedAmount - in cents
   * @param {string} date - YYYY-MM-DD
   * @param {Function} addTransaction - from useTransactions hook
   */
  const invoiceReceivable = async (receivableId, adjustedAmount, date, addTransaction) => {
    const rec = receivables.find(r => r.id === receivableId)
    if (!rec) return null

    const sourceName = rec.tasks?.title ?? rec.activities?.title ?? 'lancamento'
    const sourceLink = rec.task_id
      ? { type: 'task', id: rec.task_id }
      : { type: 'activity', id: rec.activity_id }

    const tx = await addTransaction({
      account_id: rec.target_account_id,
      amount: adjustedAmount,
      date,
      notes: `Faturamento: ${sourceName}`,
      related_to: [sourceLink],
    })
    if (!tx) return null

    try {
      const updated = await updateReceivableRecord(receivableId, {
        status: 'invoiced',
        transaction_id: tx.id,
        invoiced_at: new Date().toISOString(),
      })
      setReceivables(prev => prev.map(r => r.id === receivableId ? { ...r, ...updated } : r))
      return updated
    } catch (error) {
      console.error('Error invoicing receivable:', error)
      return null
    }
  }

  const listReceivables = ({ status, taskId } = {}) => {
    return receivables.filter(r => {
      if (status && r.status !== status) return false
      if (taskId !== undefined && r.task_id !== taskId) return false
      return true
    })
  }

  return { receivables, loading, createReceivable, createReceivableFromActivity, invoiceReceivable, listReceivables, refresh: fetch }
}
