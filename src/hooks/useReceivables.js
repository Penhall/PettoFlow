// src/hooks/useReceivables.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useReceivables() {
  const [receivables, setReceivables] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('receivables')
      .select(`
        *,
        tasks ( title, category, client_id ),
        activities ( title, id ),
        accounts ( name )
      `)
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching receivables:', error)
    else setReceivables(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  /**
   * Creates a receivable for a completed Vendas task.
   * Callers MUST run shouldCreateReceivable() before calling this.
   */
  const createReceivable = async (taskId, amount, targetAccountId) => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('receivables')
      .insert([{ task_id: taskId, amount, target_account_id: targetAccountId, status: 'pending' }])
      .select()
    if (error) { console.error('Error creating receivable:', error); return null }
    await fetch()
    return data[0]
  }

  /**
   * Creates a receivable originated from an activity.
   * @param {number} activityId
   * @param {number} amount - in cents
   * @param {number|null} targetAccountId
   * @param {string|null} dueDate - YYYY-MM-DD
   */
  const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('receivables')
      .insert([{
        activity_id: activityId,
        amount,
        target_account_id: targetAccountId,
        status: 'pending',
        due_date: dueDate,
      }])
      .select()
    if (error) { console.error('Error creating receivable from activity:', error); return null }
    await fetch()
    return data[0]
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
    if (!supabase) return null
    const rec = receivables.find(r => r.id === receivableId)
    if (!rec) return null

    // Create the real transaction via the existing hook (gets rules engine + needs_review)
    const sourceName = rec.tasks?.title ?? rec.activities?.title ?? 'lançamento'
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

    // Mark receivable as invoiced
    const { data, error } = await supabase
      .from('receivables')
      .update({ status: 'invoiced', transaction_id: tx.id, invoiced_at: new Date().toISOString() })
      .eq('id', receivableId)
      .select()
    if (error) { console.error('Error invoicing receivable:', error); return null }
    setReceivables(prev => prev.map(r => r.id === receivableId ? { ...r, ...data[0] } : r))
    return data[0]
  }

  /**
   * Returns receivables filtered by optional status and/or taskId.
   * @param {{ status?: string, taskId?: number }} options
   */
  const listReceivables = ({ status, taskId } = {}) => {
    return receivables.filter(r => {
      if (status && r.status !== status) return false
      if (taskId !== undefined && r.task_id !== taskId) return false
      return true
    })
  }

  return { receivables, loading, createReceivable, createReceivableFromActivity, invoiceReceivable, listReceivables, refresh: fetch }
}
