import { useEffect, useMemo, useRef, useState } from 'react'
import { runRulesEngine } from '../lib/rulesEngine'
import {
  listTransactionRecords,
  createTransactionRecord,
  updateTransactionRecord,
  deleteTransactionRecord,
} from '../lib/workspaceCore'
import { fail, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { filterFixtureTransactions, getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'
import { countPartialTransactionFailure } from '../lib/diagnostics.js'

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
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? filterFixtureTransactions(fixtureTransactions, JSON.parse(filtersKey)) : []))
  const rulesRef = useRef(rules)
  const transactionsRef = useRef(transactions)

  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  useEffect(() => {
    if (visualMode) {
      const fixtureData = filterFixtureTransactions(fixtureTransactions, filtersKey ? JSON.parse(filtersKey) : {})
      setTransactions(fixtureData)
      setReadResult(readSuccess(fixtureData))
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setTransactions([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)

    runReadWithRetry('transactions.list', () => listTransactionRecords(filtersKey ? JSON.parse(filtersKey) : {}, tenantId), {
      previousData: transactionsRef.current,
      signal: controller.signal,
      tenantId,
      onState: setReadResult,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.ok) setTransactions(result.data || [])
      setLoading(false)
    })

    return () => { controller.abort() }
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
    if (visualMode) return ok({ applied: 0, total: 0 })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'transactions.applyRules', code: 'missing_tenant' })

    const sortedRules = getSortedRules()
    // Only process transactions still flagged for review — already-reviewed transactions
    // are naturally idempotent since they no longer match this filter on retry.
    const pendingTransactions = transactions.filter((transaction) => transaction.needs_review)
    let applied = 0

    for (const transaction of pendingTransactions) {
      const { enriched, ruleMatched } = runRulesEngine(transaction, sortedRules)
      if (ruleMatched) {
        const result = await updateTransaction(transaction.id, { ...enriched, needs_review: false })
        if (!isMutationOk(result)) {
          if (applied > 0) {
            // Some transactions were already updated before this failure.
            // Retry is safe for remaining items because applied ones are no longer pending.
            countPartialTransactionFailure('transactions.applyRules')
          }
          return result
        }
        applied += 1
      }
    }

    return ok({ applied, total: pendingTransactions.length })
  }

  return { transactions, loading, readResult, readState: readResult.state, error: readResult.error, stale: readResult.stale, addTransaction, updateTransaction, deleteTransaction, applyRules }
}
