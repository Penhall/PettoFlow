import { beforeEach, describe, expect, it, vi } from 'vitest'

const authenticatedFetchMock = vi.fn()

vi.mock('./apiFetch.js', () => ({
  authenticatedFetch: (...args) => authenticatedFetchMock(...args),
}))

import { createBillingCheckoutSession, fetchTenantBillingOverview } from './billingApi.js'

describe('billingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envia tenantId obrigatorio ao carregar overview de billing', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ manageable: true }),
    })

    await fetchTenantBillingOverview('tenant-123')

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/tenant-core/tenants/tenant-123/billing'),
      expect.objectContaining({
        method: 'GET',
        tenantId: 'tenant-123',
        requireTenant: true,
      }),
    )
  })

  it('envia payload de checkout com tenantId e sessao autenticada', async () => {
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ url: 'https://checkout.stripe.test' }),
    })

    await createBillingCheckoutSession('tenant-123', {
      planSlug: 'growth',
      interval: 'monthly',
    })

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/tenant-core/tenants/tenant-123/billing/checkout'),
      expect.objectContaining({
        method: 'POST',
        tenantId: 'tenant-123',
        requireTenant: true,
        body: JSON.stringify({ planSlug: 'growth', interval: 'monthly' }),
      }),
    )
  })
})
