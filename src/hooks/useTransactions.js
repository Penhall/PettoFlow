import { useEffect, useMemo, useRef, useState } from 'react'
import { runRulesEngine } from '../lib/rulesEngine'
import {
  listTransactionRecords,
  createTransactionRecord,
  updateTransactionRecord,
  deleteTransactionRecord,
} from '../lib/workspaceCore'
import { fail, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { filterFixtureTransactions, getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

function normalizeTransactionsArgs(optionsOrFilters = {}, maybeRules = []) {
  if (
    optionsOrFilters &&
    typeof optionsOrFilters === 'object' &&
    ('tenantId' in optionsOrFilters || 'filters' in optionsOrFilters || 'rules' in optionsOrFilters)
  ) {
    return {
      filters: optionsOrFilters.filters || {},
      rules: optionsOrFilters.rules || [],
      tenantId: optionsOrFilters.tenantId,
    }
  }

  return {
    filters: optionsOrFilters || {},
    rules: maybeRules || [],
    tenantId: undefined,
  }
}

export function useTransactions(optionsOrFilters = {}, maybeRules = []) {
  const { filters, rules, tenantId } = normalizeTransactionsArgs(optionsOrFilters, maybeRules)
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

    if (!tenantId) {
      setTransactions([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listTransactionRecords(filtersKey ? JSON.parse(filtersKey) : {}, tenantId)
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
  }, [filtersKey, visualMode, fixtureTransactions, tenantId])

  const getSortedRules = () =>
    [...(rulesRef.current || [])].sort((left, right) =>
      left.priority !== right.priority ? left.priority - right.priority : left.id - right.id
    )

  const addTransaction = async (form) => {
    if (visualMode) return ok(form)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'transactions.add', code: 'missing_tenant' })

    const { enriched, ruleMatched } = runRulesEngine(form, getSortedRules())
    const dbPayload = { ...enriched }
    delete dbPayload.payee_name
    const payload = { ...dbPayload, needs_review: !ruleMatched }

    return runMutation('transactions.add', async () => {
      const created = await createTransactionRecord(payload, tenantId)
      setTransactions((current) => [created, ...current])
      return created
    })
  }

  const updateTransaction = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'transactions.update', code: 'missing_tenant' })

    const dbUpdates = { ...updates }
    delete dbUpdates.payee_name

    return runMutation('transactions.update', async () => {
      const updated = await updateTransactionRecord(id, dbUpdates, tenantId)
      setTransactions((current) => current.map((transaction) => (transaction.id === id ? updated : transaction)))
      return updated
    })
  }

  const deleteTransaction = async (id) => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'transactions.delete', code: 'missing_tenant' })

    return runMutation('transactions.delete', async () => {
      await deleteTransactionRecord(id, tenantId)
      setTransactions((current) => current.filter((transaction) => transaction.id !== id))
      return true
    })
  }

  const applyRules = async () => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'transactions.applyRules', code: 'missing_tenant' })

    const sortedRules = getSortedRules()
    const pendingTransactions = transactions.filter((transaction) => transaction.needs_review)

    for (const transaction of pendingTransactions) {
      const { enriched, ruleMatched } = runRulesEngine(transaction, sortedRules)
      if (ruleMatched) {
        const result = await updateTransaction(transaction.id, { ...enriched, needs_review: false })
        if (!isMutationOk(result)) return result
      }
    }

    return ok(true)
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, applyRules }
}
