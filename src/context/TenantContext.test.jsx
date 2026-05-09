import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantProvider } from './TenantContext.jsx'
import { useTenant } from '../hooks/useTenant.js'

const useAuthMock = vi.fn()
const listMyTenantsMock = vi.fn()
const createTenantMock = vi.fn()
const acceptInvitationMock = vi.fn()

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/tenantApi.js', () => ({
  listMyTenants: () => listMyTenantsMock(),
  createTenant: (...args) => createTenantMock(...args),
}))

vi.mock('../lib/memberApi.js', () => ({
  acceptInvitation: (...args) => acceptInvitationMock(...args),
}))

function TenantConsumer() {
  const { loading, hasTenant, activeTenantId, tenants, createWorkspace } = useTenant()
  const [creationResult, setCreationResult] = useState(null)

  return (
    <div>
      <span data-testid="tenant-loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="tenant-has-tenant">{hasTenant ? 'yes' : 'no'}</span>
      <span data-testid="tenant-active-id">{activeTenantId ?? 'none'}</span>
      <span data-testid="tenant-count">{String(tenants.length)}</span>
      <span data-testid="tenant-onboarding-version">{creationResult?.onboarding?.currentVersion ?? 'none'}</span>
      <span data-testid="tenant-initialization-mode">{creationResult?.onboarding?.initializationMode ?? 'none'}</span>
      <button
        type="button"
        onClick={async () => {
          const result = await createWorkspace({ name: 'Workspace Beta', slug: 'workspace-beta' })
          setCreationResult(result)
        }}
      >
        Criar workspace
      </button>
    </div>
  )
}

describe('TenantProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    useAuthMock.mockReturnValue({ isAuthenticated: true })
  })

  it('mantem usuario autenticado sem tenant no fluxo de onboarding', async () => {
    listMyTenantsMock.mockResolvedValue([])

    render(
      <TenantProvider>
        <TenantConsumer />
      </TenantProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('tenant-loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('tenant-has-tenant').textContent).toBe('no')
    expect(screen.getByTestId('tenant-active-id').textContent).toBe('none')
    expect(screen.getByTestId('tenant-count').textContent).toBe('0')
  })

  it('seleciona automaticamente o unico tenant ativo apos validar membership', async () => {
    listMyTenantsMock.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Workspace A',
        slug: 'workspace-a',
        role: 'owner',
        membershipId: 'membership-1',
        membershipStatus: 'active',
      },
    ])

    render(
      <TenantProvider>
        <TenantConsumer />
      </TenantProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('tenant-loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('tenant-has-tenant').textContent).toBe('yes')
    expect(screen.getByTestId('tenant-active-id').textContent).toBe('tenant-1')
    expect(screen.getByTestId('tenant-count').textContent).toBe('1')
    expect(window.localStorage.getItem('nexuscrm_active_tenant_id')).toBe('tenant-1')
  })

  it('aceita convite pendente antes de carregar tenants do usuario', async () => {
    window.history.replaceState({}, '', '/?invite=token-123')
    acceptInvitationMock.mockResolvedValue({ accepted: true, tenantId: 'tenant-1' })
    listMyTenantsMock.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Workspace A',
        slug: 'workspace-a',
        role: 'member',
        membershipId: 'membership-1',
        membershipStatus: 'active',
      },
    ])

    render(
      <TenantProvider>
        <TenantConsumer />
      </TenantProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('tenant-loading').textContent).toBe('ready')
    })

    expect(acceptInvitationMock).toHaveBeenCalledWith('token-123')
    expect(screen.getByTestId('tenant-active-id').textContent).toBe('tenant-1')
    expect(window.location.search).toBe('')
  })

  it('preserva metadata de onboarding ao criar um workspace novo', async () => {
    listMyTenantsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'tenant-2',
          name: 'Workspace Beta',
          slug: 'workspace-beta',
          role: 'owner',
          membershipId: 'membership-2',
          membershipStatus: 'active',
        },
      ])

    createTenantMock.mockResolvedValue({
      tenant: { id: 'tenant-2' },
      onboarding: {
        currentVersion: '2026.05',
        initializationMode: 'guided_seeded',
      },
    })

    render(
      <TenantProvider>
        <TenantConsumer />
      </TenantProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('tenant-loading').textContent).toBe('ready')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Criar workspace' }))

    await waitFor(() => {
      expect(createTenantMock).toHaveBeenCalledWith({
        name: 'Workspace Beta',
        slug: 'workspace-beta',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('tenant-onboarding-version').textContent).toBe('2026.05')
      expect(screen.getByTestId('tenant-initialization-mode').textContent).toBe('guided_seeded')
      expect(screen.getByTestId('tenant-active-id').textContent).toBe('tenant-2')
    })
  })
})
