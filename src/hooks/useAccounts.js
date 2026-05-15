import { useEffect, useMemo, useState } from 'react'
import { getPrincipalAccount as findPrincipal } from '../lib/financeUtils'
import { listAccountRecords, saveAccountRecord } from '../lib/workspaceCore'
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
    if (visualMode) return account

    try {
      const created = await saveAccountRecord(account, tenantId)
      setAccounts((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding account:', error)
      return null
    }
  }

  const updateAccount = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    try {
      const updated = await saveAccountRecord({ id, ...updates }, tenantId)
      setAccounts((current) => current.map((account) => (account.id === id ? updated : account)))
      return updated
    } catch (error) {
      console.error('Error updating account:', error)
      return null
    }
  }

  const closeAccount = async (id) => {
    if (visualMode) return true

    try {
      const updated = await saveAccountRecord({ id, is_active: false }, tenantId)
      setAccounts((current) => current.map((account) => (account.id === id ? updated : account)))
      return updated
    } catch (error) {
      console.error('Error closing account:', error)
      return null
    }
  }

  const getPrincipalAccount = () => findPrincipal(accounts)

  const getUniqueCategories = () => {
    const defaults = ['principal', 'reserva', 'extras']
    const custom = accounts.map((account) => account.category).filter(Boolean)
    return [...new Set([...defaults, ...custom])]
  }

  const setAccountCategory = async (accountId, category, demotedCategory = 'extras') => {
    if (visualMode) return { accountId, category, demotedCategory }

    if (category === 'principal') {
      const current = getPrincipalAccount()
      if (current && current.id !== accountId) {
        await updateAccount(current.id, { category: demotedCategory })
      }
    }

    return updateAccount(accountId, { category })
  }

  return { accounts, loading, addAccount, updateAccount, closeAccount, getPrincipalAccount, getUniqueCategories, setAccountCategory }
}
