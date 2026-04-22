// src/hooks/useActivityTemplates.js
import { useState, useEffect, useCallback } from 'react'
import {
  listActivityTemplateRecords,
  saveActivityTemplateRecord,
  deleteActivityTemplateRecord,
} from '../lib/workspaceCore'

export function useActivityTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listActivityTemplateRecords()
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching activity templates:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const createTemplate = async (data) => {
    try {
      const created = await saveActivityTemplateRecord(data)
      await fetch()
      return created
    } catch (error) {
      console.error('Error creating template:', error)
      return null
    }
  }

  const updateTemplate = async (id, data) => {
    try {
      const updated = await saveActivityTemplateRecord({ id, ...data })
      setTemplates(prev => prev.map(t => t.id === id ? updated : t))
      return updated
    } catch (error) {
      console.error('Error updating template:', error)
      return null
    }
  }

  const deleteTemplate = async (id) => {
    try {
      await deleteActivityTemplateRecord(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting template:', error)
      return false
    }
  }

  /**
   * Returns a pre-filled form object for an activity form.
   * Never includes date, related_to, or status - those are always set manually.
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
