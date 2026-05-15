import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listActivityTemplateRecords,
  saveActivityTemplateRecord,
  deleteActivityTemplateRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivityTemplates({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureTemplates = useMemo(() => getVisualFixture('activityTemplates', []), [])
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
      const data = await listActivityTemplateRecords(tenantId)
      setTemplates(data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching activity templates:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [visualMode, fixtureTemplates, tenantId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createTemplate = async (data) => {
    if (visualMode) return data

    try {
      const created = await saveActivityTemplateRecord(data, tenantId)
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
      const updated = await saveActivityTemplateRecord({ id, ...data }, tenantId)
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
      await deleteActivityTemplateRecord(id, tenantId)
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
