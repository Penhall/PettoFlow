// src/hooks/useFinCategories.js
// Carrega grupos e categorias em paralelo com Promise.all.
// is_income fica somente no grupo (category_groups.is_income); categorias herdam via JOIN no consumer.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useFinCategories() {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('category_groups').select('*').order('sort_order'),
      supabase.from('fin_categories').select('*').order('sort_order'),
    ]).then(([groupsRes, catsRes]) => {
      if (cancelled) return
      if (groupsRes.error) console.error('Error fetching category_groups:', groupsRes.error)
      else setGroups(groupsRes.data || [])
      if (catsRes.error) console.error('Error fetching fin_categories:', catsRes.error)
      else setCategories(catsRes.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const addGroup = async (group) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('category_groups').insert([group]).select()
    if (error) { console.error('Error adding category_group:', error); return null }
    setGroups(prev => [...prev, data[0]])
    return data[0]
  }

  const addCategory = async (category) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_categories').insert([category]).select()
    if (error) { console.error('Error adding fin_category:', error); return null }
    setCategories(prev => [...prev, data[0]])
    return data[0]
  }

  const updateCategory = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_categories').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating fin_category:', error); return null }
    setCategories(prev => prev.map(c => c.id === id ? data[0] : c))
    return data[0]
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
