import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PageActionBar from './PageActionBar.jsx'

describe('PageActionBar', () => {
  it('renders search, contextual controls, and a primary action', () => {
    const onSearch = vi.fn()
    const onPrimaryAction = vi.fn()

    render(
      <PageActionBar
        searchValue=""
        onSearch={onSearch}
        primaryAction={{ label: 'Nova tarefa', onClick: onPrimaryAction }}
      >
        <button type="button">Filtro</button>
      </PageActionBar>
    )

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar nesta pagina/i }), {
      target: { value: 'follow-up' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))

    expect(screen.getByRole('button', { name: 'Filtro' })).toBeInTheDocument()
    expect(onSearch).toHaveBeenCalledWith('follow-up')
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })
})
