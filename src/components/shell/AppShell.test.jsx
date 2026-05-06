import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell.jsx'

describe('AppShell', () => {
  it('renders sidebar, topbar, and content in the shell layout', () => {
    render(
      <AppShell
        sidebar={<nav aria-label="Principal">Sidebar</nav>}
        topbar={<div>Topbar</div>}
      >
        <section>Conteudo</section>
      </AppShell>
    )

    expect(screen.getByLabelText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Topbar')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Conteudo')
  })
})
