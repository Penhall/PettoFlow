import { useEffect, useState } from 'react'
import {
  listFinCategoryRecords,
  createCategoryGroupRecord,
  saveFinCategoryRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useFinCategories() {
  const visualMode = isVisualRegressionMode()
  const fixtureGroups = getVisualFixture('finCategoryGroups', [])
  const fixtureCategories = getVisualFixture('finCategories', [])
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

    let cancelled = false
    setLoading(true)

    listFinCategoryRecords()
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
  }, [visualMode, fixtureGroups, fixtureCategories])

  const addGroup = async (group) => {
    if (visualMode) return group

    try {
      const created = await createCategoryGroupRecord(group)
      setGroups((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding category_group:', error)
      return null
    }
  }

  const addCategory = async (category) => {
    if (visualMode) return category

    try {
      const created = await saveFinCategoryRecord(category)
      setCategories((current) => [...current, created])
      return created
    } catch (error) {
      console.error('Error adding fin_category:', error)
      return null
    }
  }

  const updateCategory = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    try {
      const updated = await saveFinCategoryRecord({ id, ...updates })
      setCategories((current) => current.map((category) => (category.id === id ? updated : category)))
      return updated
    } catch (error) {
      console.error('Error updating fin_category:', error)
      return null
    }
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
