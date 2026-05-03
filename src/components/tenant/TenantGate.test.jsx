import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TenantGate from './TenantGate.jsx'

const useTenantMock = vi.fn()

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => useTenantMock(),
}))

describe('TenantGate', () => {
  it('mostra loading enquanto os tenants carregam', () => {
    useTenantMock.mockReturnValue({
      loading: true,
      error: null,
      hasTenant: false,
      activeTenantId: null,
      tenants: [],
    })

    render(
      <TenantGate>
        <div>Dashboard</div>
      </TenantGate>,
    )

    expect(screen.getByText('Carregando workspaces do NexusCRM...')).toBeTruthy()
  })

  it('mostra onboarding quando o usuario autenticado nao possui tenant ativo', () => {
    useTenantMock.mockReturnValue({
      loading: false,
      error: null,
      hasTenant: false,
      activeTenantId: null,
      tenants: [],
    })

    render(
      <TenantGate>
        <div>Dashboard</div>
      </TenantGate>,
    )

    expect(screen.getByText('Criar seu workspace')).toBeTruthy()
  })

  it('renderiza a aplicacao quando existe tenant ativo', () => {
    useTenantMock.mockReturnValue({
      loading: false,
      error: null,
      hasTenant: true,
      activeTenantId: 'tenant-1',
      tenants: [{ id: 'tenant-1', name: 'Workspace A' }],
    })

    render(
      <TenantGate>
        <div>Dashboard</div>
      </TenantGate>,
    )

    expect(screen.getByText('Dashboard')).toBeTruthy()
  })
})
