import { useEffect, useMemo, useState } from 'react'
import {
  listFinRuleRecords,
  saveFinRuleRecord,
  deleteFinRuleRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useFinRules({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureRules = useMemo(() => getVisualFixture('finRules', []), [])
  const [rules, setRules] = useState(visualMode ? fixtureRules : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setRules(fixtureRules)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listFinRuleRecords(tenantId)
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
  }, [visualMode, fixtureRules, tenantId])

  const addRule = async (rule) => {
    if (visualMode) return rule

    try {
      const created = await saveFinRuleRecord(rule, tenantId)
      setRules((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding fin_rule:', error)
      return null
    }
  }

  const updateRule = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    try {
      const updated = await saveFinRuleRecord({ id, ...updates }, tenantId)
      setRules((current) => current.map((rule) => (rule.id === id ? updated : rule)))
      return updated
    } catch (error) {
      console.error('Error updating fin_rule:', error)
      return null
    }
  }

  const deleteRule = async (id) => {
    if (visualMode) return true

    try {
      await deleteFinRuleRecord(id, tenantId)
      setRules((current) => current.filter((rule) => rule.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting fin_rule:', error)
      return false
    }
  }

  return { rules, loading, addRule, updateRule, deleteRule }
}
