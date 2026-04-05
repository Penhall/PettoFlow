// src/hooks/useFinCategories.js
// Carrega grupos e categorias via workspace-core.
// is_income fica somente no grupo (category_groups.is_income); categorias herdam via consumer.
import { useState, useEffect } from 'react'
import {
  listFinCategoryRecords,
  createCategoryGroupRecord,
  saveFinCategoryRecord,
} from '../lib/workspaceCore'

export function useFinCategories() {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  const addGroup = async (group) => {
    try {
      const created = await createCategoryGroupRecord(group)
      setGroups(prev => [...prev, created])
      return created
    } catch (error) {
      console.error('Error adding category_group:', error)
      return null
    }
  }

  const addCategory = async (category) => {
    try {
      const created = await saveFinCategoryRecord(category)
      setCategories(prev => [...prev, created])
      return created
    } catch (error) {
      console.error('Error adding fin_category:', error)
      return null
    }
  }

  const updateCategory = async (id, updates) => {
    try {
      const updated = await saveFinCategoryRecord({ id, ...updates })
      setCategories(prev => prev.map(c => c.id === id ? updated : c))
      return updated
    } catch (error) {
      console.error('Error updating fin_category:', error)
      return null
    }
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
