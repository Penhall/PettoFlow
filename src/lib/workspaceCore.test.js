import { beforeEach, describe, expect, it, vi } from 'vitest'

const authenticatedFetchMock = vi.fn()
const getRequiredActiveTenantIdMock = vi.fn()

vi.mock('./apiFetch.js', () => ({
  authenticatedFetch: (...args) => authenticatedFetchMock(...args),
}))

vi.mock('./activeTenant.js', () => ({
  getRequiredActiveTenantId: () => getRequiredActiveTenantIdMock(),
}))

import { fetchWorkspaceBootstrap } from './workspaceCore.js'

describe('workspaceCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })
})
