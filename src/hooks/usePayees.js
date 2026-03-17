// src/hooks/usePayees.js
// Nota: deletePayee não existe — payee_id usa ON DELETE SET NULL; deletar quebraria histórico.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function usePayees() {
  const [payees, setPayees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('payees')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching payees:', error)
        else setPayees(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Cria payee e retorna o objeto criado imediatamente.
  // TransactionForm usa o ID retornado para pré-selecionar o novo payee antes de salvar.
  const addPayee = async (name) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('payees').insert([{ name }]).select()
    if (error) { console.error('Error adding payee:', error); return null }
    setPayees(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    return data[0]
  }

  const updatePayee = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('payees').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating payee:', error); return null }
    setPayees(prev => prev.map(p => p.id === id ? data[0] : p))
    return data[0]
  }

  return { payees, loading, addPayee, updatePayee }
}
