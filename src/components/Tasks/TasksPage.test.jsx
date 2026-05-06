import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TasksPage from './TasksPage.jsx'

describe('TasksPage', () => {
  it('separates header, tabs, action bar, and content views', () => {
    const onViewChange = vi.fn()
    const onCreateTask = vi.fn()
    const onSearch = vi.fn()

    render(
      <TasksPage
        tasks={[]}
        columns={[]}
        viewType="kanban"
        setViewType={onViewChange}
        searchQuery=""
        onSearch={onSearch}
        sortBy={null}
        setSortBy={() => {}}
        filterTag={null}
        setFilterTag={() => {}}
        allTags={[]}
        showSortMenu={false}
        setShowSortMenu={() => {}}
        showFilterMenu={false}
        setShowFilterMenu={() => {}}
        onCreateTask={onCreateTask}
        taskCount={0}
        content={<div>Kanban</div>}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Lista' }))
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar nesta pagina/i }), {
      target: { value: 'pipeline' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))

    expect(screen.getByRole('heading', { name: 'Tarefas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Kanban' })).toBeInTheDocument()
    expect(within(document.querySelector('.tasks-page__content')).getByText('Kanban')).toBeInTheDocument()
    expect(onViewChange).toHaveBeenCalledWith('list')
    expect(onSearch).toHaveBeenCalledWith('pipeline')
    expect(onCreateTask).toHaveBeenCalledTimes(1)
  })
})
