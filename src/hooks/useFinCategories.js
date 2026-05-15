import { useEffect, useMemo, useState } from 'react'
import {
  listFinCategoryRecords,
  createCategoryGroupRecord,
  saveFinCategoryRecord,
} from '../lib/workspaceCore'
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
    if (visualMode) return group
    if (!tenantId) return null

    try {
      const created = await createCategoryGroupRecord(group, tenantId)
      setGroups((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding category_group:', error)
      return null
    }
  }

  const addCategory = async (category) => {
    if (visualMode) return category
    if (!tenantId) return null

    try {
      const created = await saveFinCategoryRecord(category, tenantId)
      setCategories((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding fin_category:', error)
      return null
    }
  }

  const updateCategory = async (id, updates) => {
    if (visualMode) return { id, ...updates }
    if (!tenantId) return null

    try {
      const updated = await saveFinCategoryRecord({ id, ...updates }, tenantId)
      setCategories((current) => current.map((category) => (category.id === id ? updated : category)))
      return updated
    } catch (error) {
      console.error('Error updating fin_category:', error)
      return null
    }
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
