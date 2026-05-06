import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PageHeader from './PageHeader.jsx'

describe('PageHeader', () => {
  it('renders title, subtitle, and compact metrics', () => {
    render(
      <PageHeader
        title="Financas"
        subtitle="Controle entradas, saidas e previsoes."
        metrics={[{ label: 'Saldo', value: 'R$ 12.400' }]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Financas' })).toBeInTheDocument()
    expect(screen.getByText('Controle entradas, saidas e previsoes.')).toBeInTheDocument()
    expect(screen.getByText('R$ 12.400')).toBeInTheDocument()
  })
})
