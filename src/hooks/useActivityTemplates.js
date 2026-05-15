import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listActivityTemplateRecords,
  saveActivityTemplateRecord,
  deleteActivityTemplateRecord,
} from '../lib/workspaceCore'
import { fail, ok, runMutation } from '../lib/mutationResult.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivityTemplates({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureTemplates = useMemo(() => getVisualFixture('activityTemplates', []), [])
  const [templates, setTemplates] = useState(visualMode ? fixtureTemplates : [])
  const [loading, setLoading] = useState(!visualMode)
  const [readResult, setReadResult] = useState(() => readSuccess(visualMode ? fixtureTemplates : []))
  const templatesRef = useRef(templates)

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  const fetch = useCallback(async () => {
    if (visualMode) {
      setTemplates(fixtureTemplates)
      setReadResult(readSuccess(fixtureTemplates))
      setLoading(false)
      return fixtureTemplates
    }

    if (!tenantId) {
      setTemplates([])
      setReadResult(readSuccess([]))
      setLoading(false)
      return []
    }

    setLoading(true)
    const result = await runReadWithRetry('activityTemplates.list', () => listActivityTemplateRecords(tenantId), {
      previousData: templatesRef.current,
      tenantId,
      onState: setReadResult,
    })
    if (result.ok) setTemplates(result.data || [])
    setLoading(false)
    return result.data || []
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

  return { templates, loading, readResult, readState: readResult.state, error: readResult.error, stale: readResult.stale, createTemplate, updateTemplate, deleteTemplate, applyTemplate }
}
