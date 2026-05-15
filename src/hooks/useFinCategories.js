import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listFinCategoryRecords,
  createCategoryGroupRecord,
  saveFinCategoryRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useFinCategories({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureGroups = useMemo(() => getVisualFixture('finCategoryGroups', []), [])
  const fixtureCategories = useMemo(() => getVisualFixture('finCategories', []), [])
  const [groups, setGroups] = useState(visualMode ? fixtureGroups : [])
  const [categories, setCategories] = useState(visualMode ? fixtureCategories : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess({ groups: visualMode ? fixtureGroups : [], categories: visualMode ? fixtureCategories : [] }, { empty: false }))
  const dataRef = useRef({ groups, categories })

  useEffect(() => {
    dataRef.current = { groups, categories }
  }, [groups, categories])

  useEffect(() => {
    if (visualMode) {
      setGroups(fixtureGroups)
      setCategories(fixtureCategories)
      setReadResult(readSuccess({ groups: fixtureGroups, categories: fixtureCategories }, { empty: fixtureGroups.length === 0 && fixtureCategories.length === 0 }))
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setGroups([])
      setCategories([])
      setReadResult(readSuccess({ groups: [], categories: [] }, { empty: true }))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)

    runReadWithRetry('finCategories.list', () => listFinCategoryRecords(tenantId), {
      previousData: dataRef.current,
      signal: controller.signal,
      tenantId,
      onState: setReadResult,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.ok) {
        setGroups(result.data?.groups || [])
        setCategories(result.data?.categories || [])
      }
      setLoading(false)
    })

    return () => { controller.abort() }
  }, [visualMode, fixtureGroups, fixtureCategories, tenantId])

  const addGroup = async (group) => {
    if (visualMode) return ok(group)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.addGroup', code: 'missing_tenant' })

    return runMutation('finCategories.addGroup', async () => {
      const created = await createCategoryGroupRecord(group, tenantId)
      setGroups((current) => [...current, created])
      return created
    })
  }

  const addCategory = async (category) => {
    if (visualMode) return ok(category)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.addCategory', code: 'missing_tenant' })

    return runMutation('finCategories.addCategory', async () => {
      const created = await saveFinCategoryRecord(category, tenantId)
      setCategories((current) => [...current, created])
      return created
    })
  }

  const updateCategory = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'finCategories.updateCategory', code: 'missing_tenant' })

    return runMutation('finCategories.updateCategory', async () => {
      const updated = await saveFinCategoryRecord({ id, ...updates }, tenantId)
      setCategories((current) => current.map((category) => (category.id === id ? updated : category)))
      return updated
    })
  }

  return { groups, categories, loading, readResult, readState: readResult.state, error: readResult.error, stale: readResult.stale, addGroup, addCategory, updateCategory }
}
