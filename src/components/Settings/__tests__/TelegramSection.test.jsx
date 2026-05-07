import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TelegramSection from '../TelegramSection.jsx'

describe('TelegramSection', () => {
  it('informa que a configuração avançada foi bloqueada temporariamente', () => {
    render(<TelegramSection />)
    expect(screen.getByText('Configuração avançada do Telegram temporariamente bloqueada')).toBeTruthy()
    expect(screen.getByText(/será reestruturada para o modelo SaaS nas próximas fases/i)).toBeTruthy()
  })
})
