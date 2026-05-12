import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adminClient from '../../../lib/adminClient.js'
import PlansPage from '../PlansPage.jsx'

vi.mock('../../../lib/adminClient.js')

beforeEach(() => {
  vi.clearAllMocks()
})

const mockPlans = [
  {
    id: 'plan-1',
    name: 'Free',
    slug: 'free',
    price_monthly: 0,
    price_yearly: 0,
    limits: { max_users: 5, max_clients: 100, max_tasks: 500 },
    active: true,
    active_subscriptions_count: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-2',
    name: 'Growth',
    slug: 'growth',
    price_monthly: 99,
    price_yearly: 990,
    limits: { max_users: 25, max_clients: 1000, max_tasks: 5000 },
    active: true,
    active_subscriptions_count: 7,
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('PlansPage', () => {
  it('exibe estado de carregamento enquanto busca planos', () => {
    adminClient.fetchAdminPlans.mockReturnValue(new Promise(() => {}))

    render(<PlansPage />)

    expect(screen.getByText('Carregando planos...')).toBeTruthy()
  })

  it('renderiza tabela com planos após carregamento', async () => {
    adminClient.fetchAdminPlans.mockResolvedValue({ plans: mockPlans })

    render(<PlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeTruthy()
    })

    expect(screen.getByText('Growth')).toBeTruthy()
    expect(screen.getByText('free')).toBeTruthy()
    expect(screen.getByText('growth')).toBeTruthy()
  })

  it('exibe empty state quando não há planos', async () => {
    adminClient.fetchAdminPlans.mockResolvedValue({ plans: [] })

    render(<PlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum plano configurado')).toBeTruthy()
    })
  })

  it('abre modal de criação ao clicar em Novo Plano', async () => {
    adminClient.fetchAdminPlans.mockResolvedValue({ plans: mockPlans })

    render(<PlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Novo Plano'))

    expect(screen.getByText('Novo Plano', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByLabelText('Nome')).toBeTruthy()
    expect(screen.getByLabelText('Slug')).toBeTruthy()
  })

  it('exibe mensagem de erro quando fetchAdminPlans rejeita', async () => {
    adminClient.fetchAdminPlans.mockRejectedValue(new Error('Acesso negado'))

    render(<PlansPage />)

    await waitFor(() => {
      expect(screen.getByText(/Acesso negado/)).toBeTruthy()
    })
  })
})
