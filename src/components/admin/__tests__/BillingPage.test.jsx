import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adminClient from '../../../lib/adminClient.js'
import BillingPage from '../BillingPage.jsx'

vi.mock('../../../lib/adminClient.js')

beforeEach(() => {
  vi.clearAllMocks()
})

const mockBilling = {
  summary: {
    mrr_total: 1940,
    churned_mrr: 199,
    active_subscriptions: 4,
    total_subscriptions: 5,
    avg_revenue_per_tenant: 485,
  },
  by_plan: [
    { plan_name: 'growth', active: 3, mrr: 1500, tenants: 3 },
    { plan_name: 'free', active: 1, mrr: 0, tenants: 2 },
  ],
  recent_events: [
    {
      id: 'evt-1',
      tenant_id: 'tid-1',
      tenant_name: 'Petshop Alpha',
      event_type: 'invoice.payment_succeeded',
      status: 'processed',
      created_at: '2026-05-10T10:00:00Z',
      error_message: null,
    },
    {
      id: 'evt-2',
      tenant_id: 'tid-2',
      tenant_name: 'Clínica Beta',
      event_type: 'invoice.payment_failed',
      status: 'failed',
      created_at: '2026-05-09T08:00:00Z',
      error_message: 'Cartão recusado',
    },
  ],
  subscriptions_overview: [
    {
      tenant_id: 'tid-1',
      tenant_name: 'Petshop Alpha',
      plan_name: 'growth',
      status: 'active',
      current_period_end: '2026-06-10T00:00:00Z',
      days_until_renewal: 29,
    },
    {
      tenant_id: 'tid-3',
      tenant_name: 'Banho & Tosa Z',
      plan_name: 'free',
      status: 'inactive',
      current_period_end: null,
      days_until_renewal: null,
    },
  ],
}

describe('BillingPage', () => {
  it('exibe estado de carregamento enquanto busca dados', () => {
    adminClient.fetchAdminBilling.mockReturnValue(new Promise(() => {}))

    render(<BillingPage />)

    expect(screen.getByText('Carregando faturamento...')).toBeTruthy()
  })

  it('renderiza summary cards e tabelas após carregamento', async () => {
    adminClient.fetchAdminBilling.mockResolvedValue(mockBilling)

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Faturamento')).toBeTruthy()
    })

    expect(screen.getAllByText('growth').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Petshop Alpha').length).toBeGreaterThan(0)
    expect(screen.getByText('invoice.payment_succeeded')).toBeTruthy()
    expect(screen.getByText('Cartão recusado')).toBeTruthy()
    expect(screen.getByText('Banho & Tosa Z')).toBeTruthy()
  })

  it('exibe mensagem de erro quando fetchAdminBilling rejeita', async () => {
    adminClient.fetchAdminBilling.mockRejectedValue(new Error('Acesso negado'))

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Acesso negado|Erro/i)).toBeTruthy()
    })
  })

  it('exibe empty state quando listas estão vazias', async () => {
    adminClient.fetchAdminBilling.mockResolvedValue({
      summary: { mrr_total: 0, churned_mrr: 0, active_subscriptions: 0, total_subscriptions: 0, avg_revenue_per_tenant: 0 },
      by_plan: [],
      recent_events: [],
      subscriptions_overview: [],
    })

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum plano registrado')).toBeTruthy()
    })

    expect(screen.getByText('Nenhum evento de billing encontrado')).toBeTruthy()
    expect(screen.getByText('Nenhuma assinatura encontrada')).toBeTruthy()
  })
})
