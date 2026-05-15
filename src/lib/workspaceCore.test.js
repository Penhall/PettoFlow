import { beforeEach, describe, expect, it, vi } from 'vitest'

const authenticatedFetchMock = vi.fn()
const getRequiredActiveTenantIdMock = vi.fn()
const traceOwnershipMock = vi.fn()

vi.mock('./apiFetch.js', () => ({
  authenticatedFetch: (...args) => authenticatedFetchMock(...args),
}))

vi.mock('./activeTenant.js', () => ({
  getRequiredActiveTenantId: () => getRequiredActiveTenantIdMock(),
}))

vi.mock('./diagnostics.js', () => ({
  traceOwnership: (...args) => traceOwnershipMock(...args),
}))

import { createTaskRecord, fetchWorkspaceBootstrap } from './workspaceCore.js'

describe('workspaceCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    traceOwnershipMock.mockReset()
  })

  it('fails fast when there is no active tenant for business calls', async () => {
    getRequiredActiveTenantIdMock.mockImplementation(() => {
      const error = new Error('Tenant ativo obrigatorio para operacao de negocio.')
      error.code = 'TENANT_REQUIRED'
      throw error
    })

    await expect(fetchWorkspaceBootstrap()).rejects.toMatchObject({
      code: 'TENANT_REQUIRED',
    })

    expect(authenticatedFetchMock).not.toHaveBeenCalled()
  })

  it('forwards the active tenant id to authenticatedFetch', async () => {
    getRequiredActiveTenantIdMock.mockReturnValue('tenant-123')
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [], team: [], clients: [], columns: [] }),
    })

    await fetchWorkspaceBootstrap()

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/workspace-core/bootstrap'),
      expect.objectContaining({
        method: 'GET',
        tenantId: 'tenant-123',
        requireTenant: true,
      }),
    )
    expect(traceOwnershipMock).toHaveBeenCalledWith(
      'workspace-core GET /bootstrap',
      'tenant-123',
      'implicit',
      { scope: 'bootstrap' },
    )
  })

  it('surfaces quota errors returned by workspace-core', async () => {
    getRequiredActiveTenantIdMock.mockReturnValue('tenant-123')
    authenticatedFetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Limite de tarefas do plano atingido para este workspace.',
        code: 'max_tasks',
      }),
    })

    await expect(createTaskRecord({ title: 'Nova tarefa' })).rejects.toThrow(
      'Limite de tarefas do plano atingido para este workspace.',
    )
  })
})

describe('workspaceCore — explicit tenantId threading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    traceOwnershipMock.mockReset()
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'task-1', title: 'Test' }),
    })
  })

  it('createTaskRecord with explicit tenantId does NOT call getRequiredActiveTenantId', async () => {
    await createTaskRecord({ title: 'Test' }, 'explicit-tenant-789')
    expect(getRequiredActiveTenantIdMock).not.toHaveBeenCalled()
  })

  it('createTaskRecord passes explicit tenantId to authenticatedFetch', async () => {
    await createTaskRecord({ title: 'Test' }, 'explicit-tenant-789')
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/workspace-core/tasks'),
      expect.objectContaining({ tenantId: 'explicit-tenant-789' }),
    )
    expect(traceOwnershipMock).toHaveBeenCalledWith(
      'workspace-core POST /tasks',
      'explicit-tenant-789',
      'explicit',
      { scope: 'tasks' },
    )
  })

  it('createTaskRecord without tenantId falls back to getRequiredActiveTenantId', async () => {
    getRequiredActiveTenantIdMock.mockReturnValue('fallback-tenant')
    await createTaskRecord({ title: 'Test' })
    expect(getRequiredActiveTenantIdMock).toHaveBeenCalled()
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'fallback-tenant' }),
    )
    expect(traceOwnershipMock).toHaveBeenCalledWith(
      'workspace-core POST /tasks',
      'fallback-tenant',
      'implicit',
      { scope: 'tasks' },
    )
  })
})
