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

    expect(screen.getByText('Carregando espaços de trabalho do NexusCRM...')).toBeTruthy()
  })

  it('renderiza a aplicacao quando o usuario nao possui tenant', () => {
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

    expect(screen.getByText('Dashboard')).toBeTruthy()
  })

  it('mostra seletor de workspace quando existem tenants mas nenhum ativo', () => {
    useTenantMock.mockReturnValue({
      loading: false,
      error: null,
      hasTenant: true,
      activeTenantId: null,
      tenants: [{ id: 'tenant-1', name: 'Workspace A' }],
    })

    render(
      <TenantGate>
        <div>Dashboard</div>
      </TenantGate>,
    )

    expect(screen.getByText('Selecione um espaço de trabalho')).toBeTruthy()
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

  it('nao bloqueia a aplicacao se o tenant existir mesmo com falhas posteriores de onboarding', () => {
    useTenantMock.mockReturnValue({
      loading: false,
      error: null,
      hasTenant: true,
      activeTenantId: 'tenant-1',
      tenants: [{ id: 'tenant-1', name: 'Workspace A' }],
      onboardingError: 'falha ao carregar onboarding',
    })

    render(
      <TenantGate>
        <div>Área operacional</div>
      </TenantGate>,
    )

    expect(screen.getByText('Área operacional')).toBeTruthy()
  })
})
