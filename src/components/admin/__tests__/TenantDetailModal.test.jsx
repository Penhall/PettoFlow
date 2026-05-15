import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adminClient from '../../../lib/adminClient.js'
import TenantDetailModal from '../TenantDetailModal.jsx'

vi.mock('../../../lib/adminClient.js')

beforeEach(() => {
  vi.clearAllMocks()
})

const mockTenantData = {
  tenant: {
    id: 'tenant-1',
    name: 'Petshop Alpha',
    slug: 'petshop-alpha',
    owner_email: 'owner@petshop.com',
    created_at: '2026-01-15T00:00:00Z',
    subscription: { status: 'active', plan: { name: 'Free', slug: 'free' } },
    members: [],
  },
}

const mockInactiveTenantData = {
  tenant: {
    ...mockTenantData.tenant,
    subscription: { status: 'inactive', plan: { name: 'Free', slug: 'free' } },
  },
}

describe('TenantDetailModal', () => {
  it('exibe estado de carregamento enquanto busca detalhes', () => {
    adminClient.fetchAdminTenantDetail.mockReturnValue(new Promise(() => {}))

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    expect(screen.getByText('Carregando...')).toBeTruthy()
  })

  it('renderiza detalhes do tenant após carregamento', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Petshop Alpha')).toBeTruthy()
    })

    expect(screen.getByText('petshop-alpha')).toBeTruthy()
    expect(screen.getByText('owner@petshop.com')).toBeTruthy()
  })

  it('exibe erro quando fetchAdminTenantDetail rejeita', async () => {
    adminClient.fetchAdminTenantDetail.mockRejectedValue(new Error('Não autorizado'))

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível salvar a alteração/i)).toBeTruthy()
    })
  })

  it('exibe botão "Suspender espaço" quando status é active', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Suspender espaço')).toBeTruthy()
    })
  })

  it('exibe botão "Reativar espaço" quando status é inactive', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockInactiveTenantData)

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Reativar espaço')).toBeTruthy()
    })
  })

  it('chama updateTenantPlan ao clicar em Alterar Plano', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)
    adminClient.updateTenantPlan.mockResolvedValue({ ok: true })

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Alterar Plano')).toBeTruthy()
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'growth' } })
    fireEvent.click(screen.getByText('Alterar Plano'))

    await waitFor(() => {
      expect(adminClient.updateTenantPlan).toHaveBeenCalledWith('tenant-1', 'growth')
    })

    expect(screen.getByText('Plano alterado com sucesso.')).toBeTruthy()
  })

  it('chama suspendTenant ao clicar em Suspender espaço', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)
    adminClient.suspendTenant.mockResolvedValue({ ok: true })

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Suspender espaço')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Suspender espaço'))

    await waitFor(() => {
      expect(adminClient.suspendTenant).toHaveBeenCalledWith('tenant-1')
    })

    expect(screen.getByText('Espaço de trabalho suspenso com sucesso.')).toBeTruthy()
  })

  it('chama reactivateTenant ao clicar em Reativar espaço', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockInactiveTenantData)
    adminClient.reactivateTenant.mockResolvedValue({ ok: true })

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Reativar espaço')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Reativar espaço'))

    await waitFor(() => {
      expect(adminClient.reactivateTenant).toHaveBeenCalledWith('tenant-1')
    })

    expect(screen.getByText('Espaço de trabalho reativado com sucesso.')).toBeTruthy()
  })

  it('exibe erro inline quando updateTenantPlan falha', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)
    adminClient.updateTenantPlan.mockRejectedValue(new Error('Plano não encontrado'))

    render(<TenantDetailModal tenantId="tenant-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Alterar Plano')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Alterar Plano'))

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível salvar a alteração/i)).toBeTruthy()
    })
  })

  it('chama onClose ao clicar em Fechar', async () => {
    adminClient.fetchAdminTenantDetail.mockResolvedValue(mockTenantData)
    const onClose = vi.fn()

    render(<TenantDetailModal tenantId="tenant-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Fechar')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
