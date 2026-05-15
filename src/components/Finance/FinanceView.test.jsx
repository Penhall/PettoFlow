import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FinanceView from './FinanceView.jsx'
import { TenantContext } from '../../context/tenantContext.js'

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({
    accounts: [],
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    getPrincipalAccount: vi.fn(),
    getUniqueCategories: vi.fn(() => []),
    setAccountCategory: vi.fn(),
  }),
}))

vi.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({
    payees: [],
    addPayee: vi.fn(),
  }),
}))

vi.mock('../../hooks/useFinCategories', () => ({
  useFinCategories: () => ({
    groups: [],
    categories: [],
  }),
}))

vi.mock('../../hooks/useFinRules', () => ({
  useFinRules: () => ({
    rules: [],
    addRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [],
    loading: false,
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    applyRules: vi.fn(),
  }),
}))

vi.mock('../../hooks/useReceivables', () => ({
  useReceivables: () => ({
    listReceivables: vi.fn(() => []),
    invoiceReceivable: vi.fn(),
    refresh: vi.fn(),
    receivables: [],
  }),
}))

vi.mock('../../hooks/useActivities', () => ({
  useActivities: () => ({
    addActivity: vi.fn(),
  }),
}))

vi.mock('./AccountCard', () => ({
  default: () => <div>Account Card</div>,
}))

vi.mock('./TransactionList', () => ({
  default: () => <div>Transaction List</div>,
}))

vi.mock('./TransactionForm', () => ({
  default: () => null,
}))

vi.mock('./RuleBuilder', () => ({
  default: () => <div>Rule Builder</div>,
}))

vi.mock('./ReceivablesList', () => ({
  default: () => <div>Receivables List</div>,
}))

vi.mock('./FinanceSummary', () => ({
  default: () => <div>Finance Summary</div>,
}))

vi.mock('../Calendar/CalendarView', () => ({
  default: () => <div>Calendar View</div>,
}))

vi.mock('./AccountForm', () => ({
  default: () => null,
}))

describe('FinanceView', () => {
  it('renders header, segmented tabs, and contextual action bar', () => {
    render(
      <TenantContext.Provider
        value={{
          tenants: [{ id: 'tenant-1', name: 'Atlas Bio' }],
          activeTenant: { id: 'tenant-1', name: 'Atlas Bio' },
          activeTenantId: 'tenant-1',
          loading: false,
          error: null,
          hasTenant: true,
          refreshTenants: async () => [],
          createWorkspace: async () => ({}),
          setActiveTenant: () => {},
        }}
      >
        <FinanceView clients={[]} tasks={[]} team={[]} onAddTask={() => {}} columns={[]} />
      </TenantContext.Provider>
    )

    expect(screen.getByRole('heading', { name: 'Finanças' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Extrato' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova transação/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Contas' }))

    expect(screen.getByRole('button', { name: /Criar conta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abrir tutorial/i })).toBeInTheDocument()
  })
})
