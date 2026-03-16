// src/hooks/useActivities.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useActivities() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching activities:', error)
    else setActivities(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  const addActivity = async (activity) => {
    const { data, error } = await supabase
      .from('activities')
      .insert([{ ...activity, created_at: new Date() }])
      .select()
    if (error) { console.error('Error adding activity:', error); return null }
    setActivities(prev => [data[0], ...prev])
    return data[0]
  }

  const updateActivity = async (id, updates) => {
    const { data, error } = await supabase
      .from('activities')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
    if (error) { console.error('Error updating activity:', error); return null }
    setActivities(prev => prev.map(a => a.id === id ? data[0] : a))
    return data[0]
  }

  const deleteActivity = async (id) => {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
    if (error) { console.error('Error deleting activity:', error); return false }
    setActivities(prev => prev.filter(a => a.id !== id))
    return true
  }

  const getActivitiesFor = (type, id) =>
    activities.filter(a =>
      Array.isArray(a.related_to) &&
      a.related_to.some(r => r.type === type && r.id === String(id))
    )

  return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesFor }
}
