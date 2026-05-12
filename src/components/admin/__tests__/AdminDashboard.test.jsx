import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adminClient from '../../../lib/adminClient.js'
import AdminDashboard from '../AdminDashboard.jsx'

vi.mock('../../../lib/adminClient.js')

beforeEach(() => {
  vi.clearAllMocks()
})

const mockMetrics = {
  total_tenants: 12,
  active_tenants: 8,
  mrr_total: 970,
  plan_distribution: { free: 5, growth: 7 },
  recent_tenants: [
    { id: '1', name: 'Petshop Alpha', slug: 'petshop-alpha', created_at: '2026-05-01T00:00:00Z' },
    { id: '2', name: 'Clínica Beta', slug: 'clinica-beta', created_at: '2026-04-15T00:00:00Z' },
  ],
}

describe('AdminDashboard', () => {
  it('exibe estado de carregamento enquanto busca métricas', () => {
    adminClient.fetchAdminMetrics.mockReturnValue(new Promise(() => {}))

    render(<AdminDashboard />)

    expect(screen.getByText('Carregando dashboard...')).toBeTruthy()
  })

  it('renderiza métricas e tenants recentes após carregamento', async () => {
    adminClient.fetchAdminMetrics.mockResolvedValue(mockMetrics)

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('12')).toBeTruthy()
    })

    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('Petshop Alpha')).toBeTruthy()
  })

  it('exibe mensagem de erro quando fetchAdminMetrics rejeita', async () => {
    adminClient.fetchAdminMetrics.mockRejectedValue(new Error('Acesso negado'))

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Acesso negado|Erro/i)).toBeTruthy()
    })
  })
})
