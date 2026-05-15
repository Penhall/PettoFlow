import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listActivityTemplateRecords,
  saveActivityTemplateRecord,
  deleteActivityTemplateRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
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

    if (!tenantId) {
      setTemplates([])
      setLoading(false)
      return []
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
    if (visualMode) return ok(data)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activityTemplates.create', code: 'missing_tenant' })

    return runMutation('activityTemplates.create', async () => {
      const created = await saveActivityTemplateRecord(data, tenantId)
      await fetch()
      return created
    })
  }

  const updateTemplate = async (id, data) => {
    if (visualMode) return ok({ id, ...data })
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activityTemplates.update', code: 'missing_tenant' })

    return runMutation('activityTemplates.update', async () => {
      const updated = await saveActivityTemplateRecord({ id, ...data }, tenantId)
      setTemplates((current) => current.map((template) => (template.id === id ? updated : template)))
      return updated
    })
  }

  const deleteTemplate = async (id) => {
    if (visualMode) return ok(true)
    if (!tenantId) return fail(new Error('tenant required'), { operation: 'activityTemplates.delete', code: 'missing_tenant' })

    return runMutation('activityTemplates.delete', async () => {
      await deleteActivityTemplateRecord(id, tenantId)
      setTemplates((current) => current.filter((template) => template.id !== id))
      return true
    })
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
