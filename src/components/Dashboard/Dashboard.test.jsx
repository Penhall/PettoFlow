import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Dashboard from './Dashboard.jsx'

describe('Dashboard', () => {
  it('renders premium page header and task summaries', () => {
    render(
      <Dashboard
        columns={[
          { id: 1, name: 'A Fazer' },
          { id: 2, name: 'Em Progresso' },
          { id: 3, name: 'Concluido' },
        ]}
        tasks={[
          { id: 1, title: 'Proposta Atlas', status: 'A Fazer', progress: 0, owner: 'Ana Silva', deal_value: 120000, tags: ['Novo'], created_at: '2026-05-01T10:00:00Z' },
          { id: 2, title: 'Migracao Boreal', status: 'Em Progresso', progress: 64, owner: 'Leo Costa', deal_value: 230000, tags: ['Expansao'], created_at: '2026-05-02T10:00:00Z' },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Progresso por tarefa')).toBeInTheDocument()
    expect(screen.getByText('Tags em circulação')).toBeInTheDocument()
    expect(screen.getAllByText('Migracao Boreal').length).toBeGreaterThan(0)
  })
})
