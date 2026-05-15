import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listActivityRecords,
  saveActivityRecord,
  deleteActivityRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivities({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  // getVisualFixture returns a new array reference every call; memoize so
  // the useEffect dep array stays stable and doesn't loop in visual mode.
  // Empty deps: the fixture data is static module-level state that never changes at runtime.
  const fixtureActivities = useMemo(() => getVisualFixture('activities', []), [])
  const [activities, setActivities] = useState(visualMode ? fixtureActivities : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? fixtureActivities : []))
  const activitiesRef = useRef(activities)

  useEffect(() => {
    activitiesRef.current = activities
  }, [activities])

  useEffect(() => {
    if (visualMode) {
      setActivities(fixtureActivities)
      setReadResult(readSuccess(fixtureActivities))
      setLoading(false)
      return undefined
    }

    if (!tenantId) {
      setActivities([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)

    runReadWithRetry('activities.list', () => listActivityRecords(tenantId), {
      previousData: activitiesRef.current,
      signal: controller.signal,
      tenantId,
      onState: setReadResult,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.ok) setActivities(result.data || [])
      setLoading(false)
    })

    return () => { controller.abort() }
  }, [visualMode, fixtureActivities, tenantId])

  const addActivity = async (activity) => {
    if (visualMode) return ok(activity)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activities.add', code: 'missing_tenant' })

    const result = await runMutation('activities.add', async () => {
      const created = await saveActivityRecord(activity, tenantId)
      setActivities((current) => [created, ...current])
      return created
    })
    return result
  }

  const updateActivity = async (id, updates) => {
    if (visualMode) return ok({ id, ...updates })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activities.update', code: 'missing_tenant' })

    const result = await runMutation('activities.update', async () => {
      const updated = await saveActivityRecord({ id, ...updates }, tenantId)
      setActivities((current) => current.map((activity) => (activity.id === id ? updated : activity)))
      return updated
    })
    return result
  }

  const deleteActivity = async (id) => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activities.delete', code: 'missing_tenant' })

    const result = await runMutation('activities.delete', async () => {
      await deleteActivityRecord(id, tenantId)
      setActivities((current) => current.filter((activity) => activity.id !== id))
      return true
    })
    return result
  }

  const getActivitiesFor = (type, id) =>
    activities.filter((activity) =>
      Array.isArray(activity.related_to) &&
      activity.related_to.some((relation) => relation.type === type && String(relation.id) === String(id))
    )

  return {
    activities,
    loading,
    readResult,
    readState: readResult.state,
    error: readResult.error,
    stale: readResult.stale,
    retrying: readResult.state === 'retrying',
    addActivity,
    updateActivity,
    deleteActivity,
    getActivitiesFor,
  }
}
