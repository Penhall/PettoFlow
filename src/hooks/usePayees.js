import { useEffect, useState } from 'react'
import { listPayeeRecords, savePayeeRecord } from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function usePayees() {
  const visualMode = isVisualRegressionMode()
  const fixturePayees = getVisualFixture('payees', [])
  const [payees, setPayees] = useState(visualMode ? fixturePayees : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setPayees(fixturePayees)
      setLoading(false)
      return undefined
    }

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
  }, [visualMode, fixturePayees])

  const addPayee = async (name) => {
    if (visualMode) return { id: `visual-${name}`, name }

    try {
      const created = await savePayeeRecord({ name })
      setPayees((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')))
      return created
    } catch (error) {
      console.error('Error adding payee:', error)
      return null
    }
  }

  const updatePayee = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    try {
      const updated = await savePayeeRecord({ id, ...updates })
      setPayees((current) => current.map((payee) => (payee.id === id ? updated : payee)))
      return updated
    } catch (error) {
      console.error('Error updating payee:', error)
      return null
    }
  }

  return { payees, loading, addPayee, updatePayee }
}
