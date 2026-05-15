import { useEffect, useMemo, useRef, useState } from 'react'
import { listPayeeRecords, savePayeeRecord } from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function usePayees({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixturePayees = useMemo(() => getVisualFixture('payees', []), [])
  const [payees, setPayees] = useState(visualMode ? fixturePayees : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? fixturePayees : []))
  const payeesRef = useRef(payees)

  useEffect(() => {
    payeesRef.current = payees
  }, [payees])

  useEffect(() => {
    if (visualMode) {
      setPayees(fixturePayees)
      setReadResult(readSuccess(fixturePayees))
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setPayees([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)

    runReadWithRetry('payees.list', () => listPayeeRecords(tenantId), {
      previousData: payeesRef.current,
      signal: controller.signal,
      tenantId,
      onState: setReadResult,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.ok) setPayees(result.data || [])
      setLoading(false)
    })

    return () => { controller.abort() }
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

  return { payees, loading, readResult, readState: readResult.state, error: readResult.error, stale: readResult.stale, addPayee, updatePayee }
}
