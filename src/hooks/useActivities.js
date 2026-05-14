import { useEffect, useMemo, useState } from 'react'
import {
  listActivityRecords,
  saveActivityRecord,
  deleteActivityRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivities() {
  const visualMode = isVisualRegressionMode()
  // getVisualFixture returns a new array reference every call; memoize so
  // the useEffect dep array stays stable and doesn't loop in visual mode.
  const fixtureActivities = useMemo(() => getVisualFixture('activities', []), [visualMode])
  const [activities, setActivities] = useState(visualMode ? fixtureActivities : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setActivities(fixtureActivities)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listActivityRecords()
      .then((data) => {
        if (cancelled) return
        setActivities(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching activities:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [visualMode, fixtureActivities])

  const addActivity = async (activity) => {
    if (visualMode) return activity

    try {
      const created = await saveActivityRecord(activity)
      setActivities((current) => [created, ...current])
      return created
    } catch (error) {
      console.error('Error adding activity:', error)
      return null
    }
  }

  const updateActivity = async (id, updates) => {
    if (visualMode) return { id, ...updates }

    try {
      const updated = await saveActivityRecord({ id, ...updates })
      setActivities((current) => current.map((activity) => (activity.id === id ? updated : activity)))
      return updated
    } catch (error) {
      console.error('Error updating activity:', error)
      return null
    }
  }

  const deleteActivity = async (id) => {
    if (visualMode) return true

    try {
      await deleteActivityRecord(id)
      setActivities((current) => current.filter((activity) => activity.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting activity:', error)
      return false
    }
  }

  const getActivitiesFor = (type, id) =>
    activities.filter((activity) =>
      Array.isArray(activity.related_to) &&
      activity.related_to.some((relation) => relation.type === type && String(relation.id) === String(id))
    )

  return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesFor }
}
