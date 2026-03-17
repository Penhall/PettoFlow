// src/hooks/useAccounts.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('accounts')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching accounts:', error)
        else setAccounts(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const addAccount = async (account) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('accounts').insert([account]).select()
    if (error) { console.error('Error adding account:', error); return null }
    setAccounts(prev => [...prev, data[0]])
    return data[0]
  }

  const updateAccount = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating account:', error); return null }
    setAccounts(prev => prev.map(a => a.id === id ? data[0] : a))
    return data[0]
  }

  // Desativa a conta sem excluir (preserva histórico de transações)
  const closeAccount = async (id) => {
    if (!supabase) return
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    if (error) { console.error('Error closing account:', error); return }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: false } : a))
  }

  return { accounts, loading, addAccount, updateAccount, closeAccount }
}
