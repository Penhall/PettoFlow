import { useCallback, useEffect, useState } from 'react'
import {
  listActivityTemplateRecords,
  saveActivityTemplateRecord,
  deleteActivityTemplateRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivityTemplates() {
  const visualMode = isVisualRegressionMode()
  const fixtureTemplates = getVisualFixture('activityTemplates', [])
  const [templates, setTemplates] = useState(visualMode ? fixtureTemplates : [])
  const [loading, setLoading] = useState(!visualMode)

  const fetch = useCallback(async () => {
    if (visualMode) {
      setTemplates(fixtureTemplates)
      setLoading(false)
      return fixtureTemplates
    }

    setLoading(true)
    try {
      const data = await listActivityTemplateRecords()
      setTemplates(data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching activity templates:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [visualMode, fixtureTemplates])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createTemplate = async (data) => {
    if (visualMode) return data

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
    if (visualMode) return { id, ...data }

    try {
      const updated = await saveActivityTemplateRecord({ id, ...data })
      setTemplates((current) => current.map((template) => (template.id === id ? updated : template)))
      return updated
    } catch (error) {
      console.error('Error updating template:', error)
      return null
    }
  }

  const deleteTemplate = async (id) => {
    if (visualMode) return true

    try {
      await deleteActivityTemplateRecord(id)
      setTemplates((current) => current.filter((template) => template.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting template:', error)
      return false
    }
  }

  const applyTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return null
    return {
      type: template.type || '',
      notes: template.default_notes || '',
      assigned_to: template.default_assigned_to || '',
      tags: template.tags || [],
    }
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, applyTemplate }
}
