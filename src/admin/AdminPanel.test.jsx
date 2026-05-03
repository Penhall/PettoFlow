import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPanel from './AdminPanel.jsx'

const fetchAdminProfileMock = vi.fn()
const fetchAdminOverviewMock = vi.fn()
const listAdminUsersMock = vi.fn()

vi.mock('../lib/adminApi.js', () => ({
  fetchAdminProfile: () => fetchAdminProfileMock(),
  fetchAdminOverview: () => fetchAdminOverviewMock(),
  listAdminUsers: () => listAdminUsersMock(),
}))

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAdminProfileMock.mockResolvedValue({
      admin: { email: 'root@nexuscrm.test', role: 'admin' },
    })
    fetchAdminOverviewMock.mockResolvedValue({
      counts: { tenants: 2, subscriptions: 2, auditLogs: 4, billingEvents: 1 },
      tenants: [{ id: 'tenant-1', name: 'Workspace A', slug: 'workspace-a', usage: { active_members: 3, clients: 5, tasks: 12 }, created_at: '2026-05-03T10:00:00.000Z' }],
      subscriptions: [],
      auditLogs: [],
      billingEvents: [],
    })
    listAdminUsersMock.mockResolvedValue({
      items: [{ id: 'user-1', email: 'root@nexuscrm.test', createdAt: '2026-05-03T10:00:00.000Z', lastSignInAt: null }],
    })
  })

  it('renderiza metricas e tabelas do painel administrativo', async () => {
    render(<AdminPanel />)

    await waitFor(() => {
      expect(screen.getByText(/Operacao global da plataforma/i)).toBeInTheDocument()
    })

    expect(screen.getAllByText(/root@nexuscrm.test/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Tenants')).toBeInTheDocument()
    expect(screen.getByText('Workspace A')).toBeInTheDocument()
  })
})
