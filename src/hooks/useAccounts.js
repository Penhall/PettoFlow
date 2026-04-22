// src/hooks/useAccounts.js
import { useState, useEffect } from 'react'
import { getPrincipalAccount as findPrincipal } from '../lib/financeUtils'
import { listAccountRecords, saveAccountRecord } from '../lib/workspaceCore'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    listAccountRecords()
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
  }, [])

  const addAccount = async (account) => {
    try {
      const created = await saveAccountRecord(account)
      setAccounts(prev => [...prev, created])
      return created
    } catch (error) {
      console.error('Error adding account:', error)
      return null
    }
  }

  const updateAccount = async (id, updates) => {
    try {
      const updated = await saveAccountRecord({ id, ...updates })
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
      return updated
    } catch (error) {
      console.error('Error updating account:', error)
      return null
    }
  }

  const closeAccount = async (id) => {
    try {
      const updated = await saveAccountRecord({ id, is_active: false })
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
    } catch (error) {
      console.error('Error closing account:', error)
    }
  }

  const getPrincipalAccount = () => findPrincipal(accounts)

  const getUniqueCategories = () => {
    const defaults = ['principal', 'reserva', 'extras']
    const custom = accounts.map(a => a.category).filter(Boolean)
    return [...new Set([...defaults, ...custom])]
  }

  const setAccountCategory = async (accountId, category, demotedCategory = 'extras') => {
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
