import { useEffect, useMemo, useState } from 'react'
import { listPayeeRecords, savePayeeRecord } from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function usePayees({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixturePayees = useMemo(() => getVisualFixture('payees', []), [])
  const [payees, setPayees] = useState(visualMode ? fixturePayees : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setPayees(fixturePayees)
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setPayees([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listPayeeRecords(tenantId)
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
  }, [visualMode, fixturePayees, tenantId])

  const addPayee = async (name) => {
    if (visualMode) return ok({ id: `visual-${name}`, name })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'payees.add', code: 'missing_tenant' })

    return runMutation('payees.add', async () => {
      const created = await savePayeeRecord({ name }, tenantId)
      setPayees((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')))
      return created
    })
  }

  const updatePayee = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'payees.update', code: 'missing_tenant' })

    return runMutation('payees.update', async () => {
      const updated = await savePayeeRecord({ id, ...updates }, tenantId)
      setPayees((current) => current.map((payee) => (payee.id === id ? updated : payee)))
      return updated
    })
  }

  return { payees, loading, addPayee, updatePayee }
}
