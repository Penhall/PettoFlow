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

  it('maps custom workflow positions to shared status badge styles', () => {
    render(
      <ListView
        tasks={[
          {
            id: 2,
            title: 'Revisar contrato',
            status: 'Done',
            priority: 'Média',
            owner: 'Lia',
            progress: 100,
          },
        ]}
        columns={[
          { id: 1, name: 'Backlog', order_index: 1 },
          { id: 2, name: 'Doing', order_index: 2 },
          { id: 3, name: 'Done', order_index: 3 },
        ]}
        onUpdateTask={() => {}}
        onDeleteTask={() => {}}
      />
    )

    expect(screen.getByText('Done')).toHaveClass('status-badge', 'done')
  })

  it('renders the list layout when there are no tasks', () => {
    render(
      <ListView
        tasks={[]}
        columns={[
          { id: 1, name: 'Backlog', order_index: 1 },
          { id: 2, name: 'Doing', order_index: 2 },
        ]}
        onUpdateTask={() => {}}
        onDeleteTask={() => {}}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tarefa' })).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma tarefa encontrada')).not.toBeInTheDocument()
  })

  it('toggles task selection when batch mode is enabled', () => {
    const onSelectionChange = vi.fn()

    render(
      <ListView
        tasks={[
          {
            id: 3,
            title: 'Enviar proposta',
            status: 'Backlog',
            priority: 'Alta',
            owner: 'Ana',
            progress: 0,
          },
        ]}
        columns={[{ id: 1, name: 'Backlog', order_index: 1 }]}
        onUpdateTask={() => {}}
        onDeleteTask={() => {}}
        selectedTaskIds={new Set()}
        onSelectionChange={onSelectionChange}
        batchMode
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar enviar proposta/i }))

    expect(onSelectionChange).toHaveBeenCalledWith(new Set([3]))
  })
})
