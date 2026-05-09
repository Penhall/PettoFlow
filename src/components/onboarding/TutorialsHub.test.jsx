import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TutorialsHub from './TutorialsHub.jsx'

describe('TutorialsHub', () => {
  it('renders search and module categories', () => {
    render(<TutorialsHub tutorials={[]} categories={['Clientes']} />)

    expect(screen.getByPlaceholderText(/buscar tutorial/i)).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
  })
})
