import { useEffect, useMemo, useState } from 'react'
import {
  listFinRuleRecords,
  saveFinRuleRecord,
  deleteFinRuleRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
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

    if (!tenantId) {
      setRules([])
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
    if (visualMode) return ok(rule)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finRules.add', code: 'missing_tenant' })

    return runMutation('finRules.add', async () => {
      const created = await saveFinRuleRecord(rule, tenantId)
      setRules((current) => [...current, created])
      return created
    })
  }

  const updateRule = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finRules.update', code: 'missing_tenant' })

    return runMutation('finRules.update', async () => {
      const updated = await saveFinRuleRecord({ id, ...updates }, tenantId)
      setRules((current) => current.map((rule) => (rule.id === id ? updated : rule)))
      return updated
    })
  }

  const deleteRule = async (id) => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finRules.delete', code: 'missing_tenant' })

    return runMutation('finRules.delete', async () => {
      await deleteFinRuleRecord(id, tenantId)
      setRules((current) => current.filter((rule) => rule.id !== id))
      return true
    })
  }

  return { rules, loading, addRule, updateRule, deleteRule }
}
