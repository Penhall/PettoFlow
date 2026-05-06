import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ListView from './ListView.jsx'

describe('ListView', () => {
  it('advances task status using the provided column order', () => {
    const onUpdateTask = vi.fn()

    render(
      <ListView
        tasks={[
          {
            id: 1,
            title: 'Organizar proposta',
            status: 'Backlog',
            priority: 'Alta',
            owner: 'Ana',
            progress: 24,
          },
        ]}
        columns={[
          { id: 1, name: 'Backlog', order_index: 1 },
          { id: 2, name: 'Doing', order_index: 2 },
          { id: 3, name: 'Done', order_index: 3 },
        ]}
        onUpdateTask={onUpdateTask}
        onDeleteTask={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /avançar status de organizar proposta/i }))

    expect(onUpdateTask).toHaveBeenCalledWith(1, { status: 'Doing' })
  })
})
