import { useEffect, useMemo, useRef, useState } from 'react'
import { runRulesEngine } from '../lib/rulesEngine'
import {
  listTransactionRecords,
  createTransactionRecord,
  updateTransactionRecord,
  deleteTransactionRecord,
} from '../lib/workspaceCore'
import { filterFixtureTransactions, getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useTransactions(filters = {}, rules = []) {
  const visualMode = isVisualRegressionMode()
  // getVisualFixture returns a new array reference every call; memoize so
  // the effect dep array stays stable and doesn't loop in visual mode.
  const fixtureTransactions = useMemo(() => getVisualFixture('transactions', []), [])
  const filtersKey = JSON.stringify(filters)
  const [transactions, setTransactions] = useState(
    visualMode ? filterFixtureTransactions(fixtureTransactions, JSON.parse(filtersKey)) : []
  )
  const [loading, setLoading] = useState(!visualMode)
  const rulesRef = useRef(rules)

  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  useEffect(() => {
    if (visualMode) {
      setTransactions(filterFixtureTransactions(fixtureTransactions, filtersKey ? JSON.parse(filtersKey) : {}))
      setLoading(false)
      return undefined
    }

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
  }, [filtersKey, visualMode, fixtureTransactions])

  const getSortedRules = () =>
    [...(rulesRef.current || [])].sort((left, right) =>
      left.priority !== right.priority ? left.priority - right.priority : left.id - right.id
    )

  const addTransaction = async (form) => {
    if (visualMode) return form

    const { enriched, ruleMatched } = runRulesEngine(form, getSortedRules())
    const dbPayload = { ...enriched }
    delete dbPayload.payee_name
    const payload = { ...dbPayload, needs_review: !ruleMatched }

    try {
      const created = await createTransactionRecord(payload)
      setTransactions((current) => [created, ...current])
      return created
    } catch (error) {
      console.error('Error adding transaction:', error)
      return null
    }
  }

  const updateTransaction = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    const dbUpdates = { ...updates }
    delete dbUpdates.payee_name

    try {
      const updated = await updateTransactionRecord(id, dbUpdates)
      setTransactions((current) => current.map((transaction) => (transaction.id === id ? updated : transaction)))
      return updated
    } catch (error) {
      console.error('Error updating transaction:', error)
      return null
    }
  }

  const deleteTransaction = async (id) => {
    if (visualMode) return true

    try {
      await deleteTransactionRecord(id)
      setTransactions((current) => current.filter((transaction) => transaction.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting transaction:', error)
      return false
    }
  }

  const applyRules = async () => {
    if (visualMode) return true

    const sortedRules = getSortedRules()
    const pendingTransactions = transactions.filter((transaction) => transaction.needs_review)

    for (const transaction of pendingTransactions) {
      const { enriched, ruleMatched } = runRulesEngine(transaction, sortedRules)
      if (ruleMatched) {
        await updateTransaction(transaction.id, { ...enriched, needs_review: false })
      }
    }

    return true
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, applyRules }
}
