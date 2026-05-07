import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TimeView from './TimeView.jsx'

describe('TimeView', () => {
  it('renders members in the premium operational list', () => {
    render(
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
    )

    expect(screen.getByRole('heading', { name: 'Time' })).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo membro/i })).toBeInTheDocument()
    expect(screen.getByText('Follow-up Boreal')).toBeInTheDocument()
  })
})
