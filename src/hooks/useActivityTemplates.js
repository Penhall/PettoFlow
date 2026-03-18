// src/hooks/useActivityTemplates.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useActivityTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('activity_templates')
      .select('*')
      .order('name')
    if (error) console.error('Error fetching activity templates:', error)
    else setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const createTemplate = async (data) => {
    if (!supabase) return null
    const { data: created, error } = await supabase
      .from('activity_templates')
      .insert([data])
      .select()
    if (error) { console.error('Error creating template:', error); return null }
    await fetch()
    return created[0]
  }

  const updateTemplate = async (id, data) => {
    if (!supabase) return null
    const { data: updated, error } = await supabase
      .from('activity_templates')
      .update(data)
      .eq('id', id)
      .select()
    if (error) { console.error('Error updating template:', error); return null }
    setTemplates(prev => prev.map(t => t.id === id ? updated[0] : t))
    return updated[0]
  }

  const deleteTemplate = async (id) => {
    if (!supabase) return false
    const { error } = await supabase
      .from('activity_templates')
      .delete()
      .eq('id', id)
    if (error) { console.error('Error deleting template:', error); return false }
    setTemplates(prev => prev.filter(t => t.id !== id))
    return true
  }

  /**
   * Returns a pre-filled form object for an activity form.
   * Never includes date, related_to, or status — those are always set manually.
   */
  const applyTemplate = (templateId) => {
    const t = templates.find(t => t.id === templateId)
    if (!t) return null
    return {
      type: t.type || '',
      notes: t.default_notes || '',
      assigned_to: t.default_assigned_to || '',
      tags: t.tags || [],
    }
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, applyTemplate }
}
