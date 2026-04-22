// src/hooks/useTransactions.js
// filters: { accountId?, categoryId?, dateFrom?, dateTo?, needsReview?, relatedTo?: {type, id} }
// rules: FinRule[] pre-ordenada (recebida de FinanceView via useFinRules)
import { useState, useEffect, useRef } from 'react'
import { runRulesEngine } from '../lib/rulesEngine'
import {
  listTransactionRecords,
  createTransactionRecord,
  updateTransactionRecord,
  deleteTransactionRecord,
} from '../lib/workspaceCore'

export function useTransactions(filters = {}, rules = []) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const rulesRef = useRef(rules)
  useEffect(() => { rulesRef.current = rules }, [rules])

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    listTransactionRecords(filtersKey ? JSON.parse(filtersKey) : {})
      .then((data) => {
        if (cancelled) return
        setTransactions(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching transactions:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [filtersKey])

  const getSortedRules = () =>
    [...(rulesRef.current || [])].sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id - b.id
    )

  const addTransaction = async (form) => {
    const { enriched, ruleMatched } = runRulesEngine(form, getSortedRules())
    const dbPayload = { ...enriched }
    delete dbPayload.payee_name
    const payload = { ...dbPayload, needs_review: !ruleMatched }

    try {
      const created = await createTransactionRecord(payload)
      setTransactions(prev => [created, ...prev])
      return created
    } catch (error) {
      console.error('Error adding transaction:', error)
      return null
    }
  }

  const updateTransaction = async (id, updates) => {
    const dbUpdates = { ...updates }
    delete dbUpdates.payee_name

    try {
      const updated = await updateTransactionRecord(id, dbUpdates)
      setTransactions(prev => prev.map(t => t.id === id ? updated : t))
      return updated
    } catch (error) {
      console.error('Error updating transaction:', error)
      return null
    }
  }

  const deleteTransaction = async (id) => {
    try {
      await deleteTransactionRecord(id)
      setTransactions(prev => prev.filter(t => t.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting transaction:', error)
      return false
    }
  }

  const applyRules = async () => {
    const sortedRules = getSortedRules()
    const pending = transactions.filter(t => t.needs_review)
    for (const tx of pending) {
      const { enriched, ruleMatched } = runRulesEngine(tx, sortedRules)
      if (ruleMatched) {
        await updateTransaction(tx.id, { ...enriched, needs_review: false })
      }
    }
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, applyRules }
}
