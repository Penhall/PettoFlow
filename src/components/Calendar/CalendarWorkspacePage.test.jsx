import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CalendarWorkspacePage from './CalendarWorkspacePage.jsx'

vi.mock('./CalendarView.jsx', () => ({
  default: () => <div data-testid="calendar-view">calendar-grid</div>,
}))

describe('CalendarWorkspacePage', () => {
  it('renders the premium calendar shell and metrics', () => {
    render(
      <CalendarWorkspacePage
        tasks={[
          { id: 1, completed_at: null },
          { id: 2, completed_at: '2026-05-01T10:00:00Z' },
        ]}
        clients={[{ id: 1 }, { id: 2 }]}
        team={[{ id: 9 }]}
        columns={[]}
        onUpdateTask={() => {}}
        onAddTask={() => {}}
      />
    )

    expect(screen.getByRole('heading', { name: 'Calendário' })).toBeInTheDocument()
    expect(screen.getByText('Tarefas abertas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tarefas' })).toBeInTheDocument()
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })
})
