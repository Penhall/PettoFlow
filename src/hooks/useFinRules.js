// src/hooks/useFinRules.js
// Prioridade e campo numerico - sem reorderRules nem drag-and-drop.
import { useState, useEffect } from 'react'
import {
  listFinRuleRecords,
  saveFinRuleRecord,
  deleteFinRuleRecord,
} from '../lib/workspaceCore'

export function useFinRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    listFinRuleRecords()
      .then((data) => {
        if (cancelled) return
        setRules(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching fin_rules:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const addRule = async (rule) => {
    try {
      const created = await saveFinRuleRecord(rule)
      setRules(prev => [...prev, created])
      return created
    } catch (error) {
      console.error('Error adding fin_rule:', error)
      return null
    }
  }

  const updateRule = async (id, updates) => {
    try {
      const updated = await saveFinRuleRecord({ id, ...updates })
      setRules(prev => prev.map(r => r.id === id ? updated : r))
      return updated
    } catch (error) {
      console.error('Error updating fin_rule:', error)
      return null
    }
  }

  const deleteRule = async (id) => {
    try {
      await deleteFinRuleRecord(id)
      setRules(prev => prev.filter(r => r.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting fin_rule:', error)
      return false
    }
  }

  return { rules, loading, addRule, updateRule, deleteRule }
}
