import { useEffect, useMemo, useState } from 'react'
import { getPrincipalAccount as findPrincipal } from '../lib/financeUtils'
import { listAccountRecords, saveAccountRecord } from '../lib/workspaceCore'
import { fail, getMutationData, isMutationOk, ok, runMutation } from '../lib/mutationResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useAccounts({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureAccounts = useMemo(() => getVisualFixture('accounts', []), [])
  const [accounts, setAccounts] = useState(visualMode ? fixtureAccounts : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setAccounts(fixtureAccounts)
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setAccounts([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listAccountRecords(tenantId)
      .then((data) => {
        if (cancelled) return
        setAccounts(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching accounts:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
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
        const demoteResult = await updateAccount(current.id, { category: demotedCategory })
        if (!isMutationOk(demoteResult)) return demoteResult
      }
    }

    const result = await updateAccount(accountId, { category })
    return isMutationOk(result) ? ok(getMutationData(result)) : result
  }

  return { accounts, loading, addAccount, updateAccount, closeAccount, getPrincipalAccount, getUniqueCategories, setAccountCategory }
}
