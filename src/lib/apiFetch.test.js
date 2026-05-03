import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from './supabaseClient.js'
import { authenticatedFetch } from './apiFetch.js'

describe('authenticatedFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  it('adds bearer token from the current session', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    })
    fetch.mockResolvedValue({ ok: true, status: 200 })

    await authenticatedFetch('https://example.com/data', { method: 'GET' })

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/data',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    )
  })

  it('adds content-type for json requests with body', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    })
    fetch.mockResolvedValue({ ok: true, status: 200 })

    await authenticatedFetch('https://example.com/data', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/data',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('adds X-Tenant-Id when tenantId is provided', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    })
    fetch.mockResolvedValue({ ok: true, status: 200 })

    await authenticatedFetch('https://example.com/data', {
      method: 'GET',
      tenantId: 'tenant-abc',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/data',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'X-Tenant-Id': 'tenant-abc',
        }),
      }),
    )
  })

  it('throws when there is no authenticated session', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    })

    await expect(
      authenticatedFetch('https://example.com/data'),
    ).rejects.toMatchObject({
      code: 'AUTH_SESSION_MISSING',
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws when tenant is required but missing', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    })

    await expect(
      authenticatedFetch('https://example.com/data', {
        method: 'GET',
        requireTenant: true,
      }),
    ).rejects.toMatchObject({
      code: 'TENANT_REQUIRED',
    })

    expect(fetch).not.toHaveBeenCalled()
  })
})
