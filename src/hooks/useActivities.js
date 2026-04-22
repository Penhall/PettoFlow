// src/hooks/useActivities.js
import { useState, useEffect } from 'react'
import {
  listActivityRecords,
  saveActivityRecord,
  deleteActivityRecord,
} from '../lib/workspaceCore'

export function useActivities() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  const addActivity = async (activity) => {
    try {
      const created = await saveActivityRecord(activity)
      setActivities(prev => [created, ...prev])
      return created
    } catch (error) {
      console.error('Error adding activity:', error)
      return null
    }
  }

  const updateActivity = async (id, updates) => {
    try {
      const updated = await saveActivityRecord({ id, ...updates })
      setActivities(prev => prev.map(a => a.id === id ? updated : a))
      return updated
    } catch (error) {
      console.error('Error updating activity:', error)
      return null
    }
  }

  const deleteActivity = async (id) => {
    try {
      await deleteActivityRecord(id)
      setActivities(prev => prev.filter(a => a.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting activity:', error)
      return false
    }
  }

  const getActivitiesFor = (type, id) =>
    activities.filter(a =>
      Array.isArray(a.related_to) &&
      a.related_to.some(r => r.type === type && String(r.id) === String(id))
    )

  return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesFor }
}
