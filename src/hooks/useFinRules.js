// src/hooks/useFinRules.js
// Prioridade é campo numérico — sem reorderRules nem drag-and-drop.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useFinRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('fin_rules')
      .select('*')
      .order('priority', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching fin_rules:', error)
        else setRules(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const addRule = async (rule) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_rules').insert([rule]).select()
    if (error) { console.error('Error adding fin_rule:', error); return null }
    setRules(prev => [...prev, data[0]])
    return data[0]
  }

  const updateRule = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_rules').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating fin_rule:', error); return null }
    setRules(prev => prev.map(r => r.id === id ? data[0] : r))
    return data[0]
  }

  const deleteRule = async (id) => {
    if (!supabase) return false
    const { error } = await supabase.from('fin_rules').delete().eq('id', id)
    if (error) { console.error('Error deleting fin_rule:', error); return false }
    setRules(prev => prev.filter(r => r.id !== id))
    return true
  }

  return { rules, loading, addRule, updateRule, deleteRule }
}
