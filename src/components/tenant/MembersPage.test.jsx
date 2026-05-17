import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MembersPage from './MembersPage.jsx'

const useTenantMock = vi.fn()
const useMembersMock = vi.fn()

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => useTenantMock(),
}))

vi.mock('../../hooks/useMembers.js', () => ({
  useMembers: () => useMembersMock(),
}))

const usePlanFeatureMock = vi.fn()

vi.mock('../../hooks/usePlanFeature.js', () => ({
  usePlanFeature: () => usePlanFeatureMock(),
}))

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePlanFeatureMock.mockReturnValue({ isEnabled: true, loading: false })
  })

  it('bloqueia a gestao para usuarios sem permissao administrativa', () => {
    useTenantMock.mockReturnValue({
      activeTenant: { id: 'tenant-1', role: 'member', name: 'Workspace A' },
    })
    useMembersMock.mockReturnValue({
      members: [],
      invitations: [],
      loading: false,
      error: null,
    })

    render(<MembersPage />)

    expect(screen.getByText('Apenas proprietários e admins podem gerenciar membros.')).toBeTruthy()
  })

  it('permite criar convite quando o tenant ativo e administravel', async () => {
    const inviteMember = vi.fn().mockResolvedValue({})
    useTenantMock.mockReturnValue({
      activeTenant: { id: 'tenant-1', role: 'owner', name: 'Workspace A' },
    })
    useMembersMock.mockReturnValue({
      members: [],
      invitations: [],
      loading: false,
      error: null,
      inviteMember,
      updateMemberRole: vi.fn(),
      setMemberStatus: vi.fn(),
      removeMember: vi.fn(),
      refresh: vi.fn(),
    })

    render(<MembersPage />)

    fireEvent.change(screen.getByLabelText('Email do convidado'), {
      target: { value: 'colab@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Perfil do convite'), {
      target: { value: 'member' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))

    await waitFor(() => {
      expect(inviteMember).toHaveBeenCalledWith({
        email: 'colab@example.com',
        role: 'member',
      })
    })
  })

  it('mostra upsell para plano sem multi_user', () => {
    usePlanFeatureMock.mockReturnValue({ isEnabled: false, loading: false })
    useTenantMock.mockReturnValue({
      activeTenant: { id: 'tenant-1', role: 'owner', name: 'Workspace A' },
    })
    useMembersMock.mockReturnValue({
      members: [],
      invitations: [],
      loading: false,
      error: null,
    })

    render(<MembersPage />)

    expect(screen.getByText('Colaboração em equipe')).toBeTruthy()
    expect(screen.getByText(/Faça upgrade para o/)).toBeTruthy()
  })

  it('permite owner alterar role de membro elegivel', async () => {
    const updateMemberRole = vi.fn().mockResolvedValue({})
    useTenantMock.mockReturnValue({
      activeTenant: { id: 'tenant-1', role: 'owner', name: 'Workspace A' },
    })
    useMembersMock.mockReturnValue({
      members: [
        { id: 'membership-1', email: 'user@example.com', role: 'member', status: 'active' },
      ],
      invitations: [],
      loading: false,
      error: null,
      inviteMember: vi.fn(),
      updateMemberRole,
      setMemberStatus: vi.fn(),
      removeMember: vi.fn(),
      refresh: vi.fn(),
    })

    render(<MembersPage />)

    fireEvent.change(screen.getByLabelText('Perfil de user@example.com'), {
      target: { value: 'admin' },
    })

    await waitFor(() => {
      expect(updateMemberRole).toHaveBeenCalledWith('membership-1', 'admin')
    })
  })
})
