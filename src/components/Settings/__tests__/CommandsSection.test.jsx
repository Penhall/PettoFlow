import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CommandsSection from '../CommandsSection.jsx'

describe('CommandsSection', () => {
  it('informa que os comandos administrativos foram bloqueados temporariamente', () => {
    render(<CommandsSection />)
    expect(screen.getByText('Comandos administrativos do Telegram temporariamente bloqueados')).toBeTruthy()
    expect(screen.getByText(/continuam fora do fluxo principal/i)).toBeTruthy()
  })
})
