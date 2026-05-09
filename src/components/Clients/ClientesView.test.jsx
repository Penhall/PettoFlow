import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ClientesView from './ClientesView.jsx'

vi.mock('./ClientProfileModal', () => ({
  default: ({ isOpen, client }) => (isOpen ? <div data-testid="client-profile-modal">{client?.name}</div> : null),
}))

describe('ClientesView', () => {
  it('renders clients in the premium portfolio list', () => {
    render(
      <ClientesView
        clients={[
          { id: 3, name: 'Atlas Bio', industry: 'Saude', projects: 2, revenue: 'R$ 40.000', status: 'Ativo', email: 'oi@atlas.test', phone: '11 99999-0000' },
        ]}
        tasks={[
          { id: 11, client_id: 3, title: 'Renovar proposta', deal_value: 80000 },
        ]}
        onRefresh={() => {}}
        searchQuery=""
      />
    )

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.getByText('Atlas Bio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo cliente/i })).toBeInTheDocument()
    expect(screen.getByText('1 tarefa em curso')).toBeInTheDocument()
  })

  it('renders onboarding-aware empty state actions', () => {
    render(
      <ClientesView
        clients={[]}
        tasks={[]}
        onRefresh={() => {}}
        searchQuery=""
        onOpenTutorial={() => {}}
        onTrackOnboarding={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /Criar cliente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Importar contatos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abrir tutorial/i })).toBeInTheDocument()
  })
})
