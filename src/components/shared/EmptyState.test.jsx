import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EmptyState from './EmptyState.jsx'

describe('EmptyState', () => {
  it('explains purpose, reason, and next action', () => {
    render(
      <EmptyState
        title="Nenhuma regra criada"
        description="As regras automatizam a classificacao das transacoes."
        detail="Este espaco esta vazio porque nenhuma automacao foi configurada."
        quickActions={[{ id: 'create-rule', label: 'Criar regra', onClick: () => {} }]}
        tutorialAction={{ label: 'Abrir tutorial', onClick: () => {} }}
        action={<button type="button">Criar regra</button>}
      />
    )

    expect(screen.getByText('Nenhuma regra criada')).toBeInTheDocument()
    expect(screen.getByText(/automatizam a classificacao/i)).toBeInTheDocument()
    expect(screen.getByText(/nenhuma automacao/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Criar regra' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Abrir tutorial' })).toBeInTheDocument()
  })
})
