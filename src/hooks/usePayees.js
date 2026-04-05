// src/hooks/usePayees.js
// Nota: deletePayee nao existe - payee_id usa ON DELETE SET NULL; deletar quebraria historico.
import { useState, useEffect } from 'react'
import { listPayeeRecords, savePayeeRecord } from '../lib/workspaceCore'

export function usePayees() {
  const [payees, setPayees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    listPayeeRecords()
      .then((data) => {
        if (cancelled) return
        setPayees(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching payees:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const addPayee = async (name) => {
    try {
      const created = await savePayeeRecord({ name })
      setPayees(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      return created
    } catch (error) {
      console.error('Error adding payee:', error)
      return null
    }
  }

  const updatePayee = async (id, updates) => {
    try {
      const updated = await savePayeeRecord({ id, ...updates })
      setPayees(prev => prev.map(p => p.id === id ? updated : p))
      return updated
    } catch (error) {
      console.error('Error updating payee:', error)
      return null
    }
  }

  return { payees, loading, addPayee, updatePayee }
}
