import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BillingPage from './BillingPage.jsx'

const useTenantMock = vi.fn()
const fetchTenantBillingOverviewMock = vi.fn()
const createBillingCheckoutSessionMock = vi.fn()
const createBillingPortalSessionMock = vi.fn()

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => useTenantMock(),
}))

vi.mock('../../lib/billingApi.js', () => ({
  fetchTenantBillingOverview: (...args) => fetchTenantBillingOverviewMock(...args),
  createBillingCheckoutSession: (...args) => createBillingCheckoutSessionMock(...args),
  createBillingPortalSession: (...args) => createBillingPortalSessionMock(...args),
}))

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTenantMock.mockReturnValue({
      activeTenant: { id: 'tenant-1', name: 'Workspace A' },
      activeTenantId: 'tenant-1',
    })
  })

  it('mostra mensagem de permissoes quando o billing nao e gerenciavel', async () => {
    fetchTenantBillingOverviewMock.mockResolvedValue({
      manageable: false,
      stripeConfigured: true,
      subscription: {
        plan: {
          name: 'Free',
          slug: 'free',
          description: 'Plano inicial',
          limits: { max_users: 5, max_clients: 100, max_tasks: 500, max_activities: 500, max_transactions: 1000 },
        },
        provider: 'internal',
        status: 'active',
        currentPeriodEnd: null,
      },
      usage: { active_members: 1, clients: 2, tasks: 3, activities: 4, transactions: 5 },
      plans: [],
    })

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Apenas owner\/admin podem iniciar upgrade/i)).toBeInTheDocument()
    })
  })

  it('aciona checkout para o plano selecionado quando gerenciavel', async () => {
    fetchTenantBillingOverviewMock.mockResolvedValue({
      manageable: true,
      stripeConfigured: true,
      subscription: {
        plan: {
          name: 'Free',
          slug: 'free',
          description: 'Plano inicial',
          limits: { max_users: 5, max_clients: 100, max_tasks: 500, max_activities: 500, max_transactions: 1000 },
        },
        provider: 'internal',
        status: 'active',
        currentPeriodEnd: null,
      },
      usage: { active_members: 1, clients: 2, tasks: 3, activities: 4, transactions: 5 },
      plans: [{
        id: 'plan-1',
        slug: 'growth',
        name: 'Growth',
        description: 'Escala',
        priceMonthly: 99,
        priceYearly: 990,
        monthlyAvailable: true,
        yearlyAvailable: false,
      }],
    })
    createBillingCheckoutSessionMock.mockRejectedValue(new Error('checkout indisponivel'))

    render(<BillingPage />)

    await waitFor(() => {
      expect(screen.getByText('Growth')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Assinar mensal/i }))

    await waitFor(() => {
      expect(createBillingCheckoutSessionMock).toHaveBeenCalledWith('tenant-1', {
        planSlug: 'growth',
        interval: 'monthly',
      })
    })
  })
})
