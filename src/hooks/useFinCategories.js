import { useEffect, useMemo, useState } from 'react'
import {
  listFinCategoryRecords,
  createCategoryGroupRecord,
  saveFinCategoryRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useFinCategories({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureGroups = useMemo(() => getVisualFixture('finCategoryGroups', []), [])
  const fixtureCategories = useMemo(() => getVisualFixture('finCategories', []), [])
  const [groups, setGroups] = useState(visualMode ? fixtureGroups : [])
  const [categories, setCategories] = useState(visualMode ? fixtureCategories : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setGroups(fixtureGroups)
      setCategories(fixtureCategories)
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setGroups([])
      setCategories([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listFinCategoryRecords(tenantId)
      .then((data) => {
        if (cancelled) return
        setGroups(data?.groups || [])
        setCategories(data?.categories || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching fin categories:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [visualMode, fixtureGroups, fixtureCategories, tenantId])

  const addGroup = async (group) => {
    if (visualMode) return ok(group)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.addGroup', code: 'missing_tenant' })

    return runMutation('finCategories.addGroup', async () => {
      const created = await createCategoryGroupRecord(group, tenantId)
      setGroups((current) => [...current, created])
      return created
    })
  }

  const addCategory = async (category) => {
    if (visualMode) return ok(category)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.addCategory', code: 'missing_tenant' })

    return runMutation('finCategories.addCategory', async () => {
      const created = await saveFinCategoryRecord(category, tenantId)
      setCategories((current) => [...current, created])
      return created
    })
  }

  const updateCategory = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.updateCategory', code: 'missing_tenant' })

    return runMutation('finCategories.updateCategory', async () => {
      const updated = await saveFinCategoryRecord({ id, ...updates }, tenantId)
      setCategories((current) => current.map((category) => (category.id === id ? updated : category)))
      return updated
    })
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
