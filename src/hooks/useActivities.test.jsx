import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActivities } from './useActivities.js'

const listActivityRecordsMock = vi.fn()
const saveActivityRecordMock = vi.fn()
const deleteActivityRecordMock = vi.fn()

vi.mock('../lib/workspaceCore', () => ({
  listActivityRecords: (...args) => listActivityRecordsMock(...args),
  saveActivityRecord: (...args) => saveActivityRecordMock(...args),
  deleteActivityRecord: (...args) => deleteActivityRecordMock(...args),
}))

vi.mock('../visual/fixtureRuntime.js', () => ({
  getVisualFixture: () => [],
  isVisualRegressionMode: () => false,
}))

describe('useActivities mutation semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listActivityRecordsMock.mockResolvedValue([])
    saveActivityRecordMock.mockResolvedValue({ id: 1, title: 'Follow-up' })
    deleteActivityRecordMock.mockResolvedValue({})
  })

  it('returns an explicit ok result only after persistence succeeds', async () => {
    const { result } = renderHook(() => useActivities({ tenantId: 'tenant-1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let mutation
    await act(async () => {
      mutation = await result.current.addActivity({ title: 'Follow-up' })
    })

    expect(mutation).toMatchObject({ ok: true, data: { id: 1, title: 'Follow-up' }, error: null })
    expect(result.current.activities).toEqual([{ id: 1, title: 'Follow-up' }])
  })

  it('preserves local state and returns a safe failure result when persistence fails', async () => {
    saveActivityRecordMock.mockRejectedValueOnce(new Error('Supabase SQL failed'))

    const { result } = renderHook(() => useActivities({ tenantId: 'tenant-1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let mutation
    await act(async () => {
      mutation = await result.current.addActivity({ title: 'Do not commit' })
    })

    expect(mutation.ok).toBe(false)
    expect(mutation.error.message).toBe('Não foi possível salvar a alteração. Revise os dados e tente novamente.')
    expect(mutation.error.diagnostics.rawMessage).toContain('Supabase SQL failed')
    expect(result.current.activities).toEqual([])
  })

  it('rejects mutations without an active tenant explicitly', async () => {
    const { result } = renderHook(() => useActivities({ tenantId: null }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let mutation
    await act(async () => {
      mutation = await result.current.addActivity({ title: 'No tenant' })
    })

    expect(mutation).toMatchObject({
      ok: false,
      code: 'missing_tenant',
      error: { message: 'Selecione um espaço de trabalho ativo e tente novamente.' },
    })
    expect(saveActivityRecordMock).not.toHaveBeenCalled()
  })
})
