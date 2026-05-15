import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ActivitiesView from './ActivitiesView.jsx'
import { TenantContext } from '../../context/tenantContext.js'

vi.mock('../../hooks/useActivities', () => ({
  useActivities: () => ({
    activities: [],
    loading: false,
    addActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
  }),
}))

vi.mock('../../hooks/useActivityTemplates', () => ({
  useActivityTemplates: () => ({
    templates: [],
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    applyTemplate: vi.fn(),
  }),
}))

vi.mock('../../hooks/useReceivables', () => ({
  useReceivables: () => ({
    createReceivableFromActivity: vi.fn(),
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    addTransaction: vi.fn(),
  }),
}))

vi.mock('../../hooks/useFinRules', () => ({
  useFinRules: () => ({
    rules: [],
  }),
}))

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({
    accounts: [],
  }),
}))

vi.mock('./ActivityTimeline', () => ({
  default: () => <div>Activity Timeline</div>,
}))

vi.mock('./TemplatesTab', () => ({
  default: () => <div>Templates Tab</div>,
}))

vi.mock('./ActivityForm', () => ({
  default: () => null,
}))

vi.mock('./ActivityTemplateForm', () => ({
  default: () => null,
}))

vi.mock('../Calendar/CalendarView', () => ({
  default: () => <div>Calendar View</div>,
}))

describe('ActivitiesView', () => {
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
        <ActivitiesView clients={[]} tasks={[]} team={[]} searchQuery="" onSearch={() => {}} />
      </TenantContext.Provider>
    )

    expect(screen.getByRole('heading', { name: 'Atividades' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Timeline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova atividade/i })).toBeInTheDocument()
  })
})
