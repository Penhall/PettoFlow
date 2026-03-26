// src/components/Calendar/EventDetailPanel.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EventDetailPanel from './EventDetailPanel'

// Framer Motion faz side effects com DOM — mockar para testes unitários
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}))

const makeEvent = (type, payload = {}) => ({
  id: `${type}-1`,
  title: 'Teste',
  date: '2026-03-26',
  type,
  color: '#000',
  sourceId: 1,
  sourceType: type,
  payload: { id: 1, amount: 10000, ...payload },
})

describe('EventDetailPanel — contextArea', () => {
  it('mostra Follow-up e Criar Tarefa em receivable sem contextArea', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
  })

  it('oculta Follow-up e Criar Tarefa em receivable com contextArea="financas"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
        contextArea="financas"
      />
    )
    expect(screen.queryByText('Follow-up')).not.toBeInTheDocument()
    expect(screen.queryByText('Criar Tarefa')).not.toBeInTheDocument()
    // Faturar deve continuar visível
    expect(screen.getByText('Faturar')).toBeInTheDocument()
  })

  it('oculta Criar Tarefa e Criar Atividade em transaction com contextArea="financas"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('transaction')}
        onClose={vi.fn()}
        contextArea="financas"
      />
    )
    expect(screen.queryByText('Criar Tarefa')).not.toBeInTheDocument()
    expect(screen.queryByText('Criar Atividade')).not.toBeInTheDocument()
  })

  it('mantém todas as ações em transaction sem contextArea', () => {
    render(
      <EventDetailPanel
        event={makeEvent('transaction')}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
    expect(screen.getByText('Criar Atividade')).toBeInTheDocument()
  })

  it('não suprime nada em contextArea="atividades"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
        contextArea="atividades"
      />
    )
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
  })
})
