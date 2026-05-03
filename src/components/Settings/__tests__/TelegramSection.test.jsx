import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TelegramSection from '../TelegramSection.jsx'

describe('TelegramSection', () => {
  it('informa que a configuracao avancada foi bloqueada temporariamente', () => {
    render(<TelegramSection />)
    expect(screen.getByText('Configuracao avancada do Telegram temporariamente bloqueada')).toBeTruthy()
    expect(screen.getByText(/sera reestruturada para o modelo SaaS nas proximas fases/i)).toBeTruthy()
  })
})
