import { beforeEach, describe, expect, it, vi } from 'vitest'

const authenticatedFetchMock = vi.fn()

vi.mock('./apiFetch.js', () => ({
  authenticatedFetch: (...args) => authenticatedFetchMock(...args),
}))

import { fetchAdminOverview, listAdminUsers } from './adminApi.js'

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('monta a chamada de overview do admin-core com pagina', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ counts: { tenants: 3 } }),
    })

    await fetchAdminOverview({ page: 2, pageSize: 10 })

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/admin-core/overview?page=2&pageSize=10'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('monta a chamada de usuarios do admin-core com paginacao', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    })

    await listAdminUsers({ page: 3, perPage: 50 })

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/admin-core/users?page=3&perPage=50'),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
