import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TimeView from './TimeView.jsx'
import { TenantContext } from '../../context/tenantContext.js'

describe('TimeView', () => {
  it('renders members in the premium operational list', () => {
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
      <TimeView
        tasks={[
          { id: 1, title: 'Follow-up Boreal', owner: 'Ana Silva', completed_at: null },
          { id: 2, title: 'Contrato Atlas', owner: 'Ana Silva', completed_at: '2026-05-01T10:00:00Z' },
        ]}
        team={[
          { id: 10, name: 'Ana Silva', role: 'Operacoes', status: 'Ativo', email: 'ana@nexuscrm.test' },
        ]}
        onRefresh={() => {}}
        searchQuery=""
      />
      </TenantContext.Provider>
    )

    expect(screen.getByRole('heading', { name: 'Time' })).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo membro/i })).toBeInTheDocument()
    expect(screen.getByText('Follow-up Boreal')).toBeInTheDocument()
  })
})
