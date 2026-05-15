import { useEffect, useMemo, useRef, useState } from 'react'
import { getPrincipalAccount as findPrincipal } from '../lib/financeUtils'
import { listAccountRecords, saveAccountRecord } from '../lib/workspaceCore'
import { fail, getMutationData, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'
import { countOrphanStateRisk, countPartialTransactionFailure } from '../lib/diagnostics.js'

export function useAccounts({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureAccounts = useMemo(() => getVisualFixture('accounts', []), [])
  const [accounts, setAccounts] = useState(visualMode ? fixtureAccounts : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? fixtureAccounts : []))
  const accountsRef = useRef(accounts)

  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    if (visualMode) {
      setAccounts(fixtureAccounts)
      setReadResult(readSuccess(fixtureAccounts))
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setAccounts([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)

    runReadWithRetry('accounts.list', () => listAccountRecords(tenantId), {
      previousData: accountsRef.current,
      signal: controller.signal,
      tenantId,
      onState: setReadResult,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.ok) setAccounts(result.data || [])
      setLoading(false)
    })

    return () => { controller.abort() }
  }, [visualMode, fixtureAccounts, tenantId])

  const addAccount = async (account) => {
    if (visualMode) return ok(account)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'accounts.add', code: 'missing_tenant' })

    return runMutation('accounts.add', async () => {
      const created = await saveAccountRecord(account, tenantId)
      setAccounts((current) => [...current, created])
      return created
    })
  }

  const updateAccount = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'accounts.update', code: 'missing_tenant' })

    return runMutation('accounts.update', async () => {
      const updated = await saveAccountRecord({ id, ...updates }, tenantId)
      setAccounts((current) => current.map((account) => (account.id === id ? updated : account)))
      return updated
    })
  }

  const closeAccount = async (id) => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'accounts.close', code: 'missing_tenant' })

    return runMutation('accounts.close', async () => {
      const updated = await saveAccountRecord({ id, is_active: false }, tenantId)
      setAccounts((current) => current.map((account) => (account.id === id ? updated : account)))
      return updated
    })
  }

  const getPrincipalAccount = () => findPrincipal(accounts)

  const getUniqueCategories = () => {
    const defaults = ['principal', 'reserva', 'extras']
    const custom = accounts.map((account) => account.category).filter(Boolean)
    return [...new Set([...defaults, ...custom])]
  }

  const setAccountCategory = async (accountId, category, demotedCategory = 'extras') => {
    if (visualMode) return ok({ accountId, category, demotedCategory })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'accounts.setCategory', code: 'missing_tenant' })

    if (category === 'principal') {
      const current = getPrincipalAccount()
      if (current && current.id !== accountId) {
        // Step 1: demote the existing principal account
        const demoteResult = await updateAccount(current.id, { category: demotedCategory })
        if (!isMutationOk(demoteResult)) return demoteResult

        // Step 2: promote the target account — partial-failure risk after step 1 succeeded.
        // If this fails, no account holds the "principal" category.
        const promoteResult = await updateAccount(accountId, { category })
        if (!isMutationOk(promoteResult)) {
          countPartialTransactionFailure('accounts.setCategory')
          countOrphanStateRisk('accounts.setCategory')
          return fail(
            new Error('promote failed after demote'),
            { operation: 'accounts.setCategory', code: 'partial_category_failure' }
          )
        }
        return ok(getMutationData(promoteResult))
      }
    }

    const result = await updateAccount(accountId, { category })
    return isMutationOk(result) ? ok(getMutationData(result)) : result
  }

  return { accounts, loading, readResult, readState: readResult.state, error: readResult.error, stale: readResult.stale, addAccount, updateAccount, closeAccount, getPrincipalAccount, getUniqueCategories, setAccountCategory }
}
