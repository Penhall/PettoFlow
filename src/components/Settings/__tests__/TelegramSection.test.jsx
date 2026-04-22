// src/components/Settings/__tests__/TelegramSection.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TelegramSection from '../TelegramSection.jsx'
import * as botConfig from '../../../lib/botConfig.js'

vi.mock('../../../lib/botConfig.js')

describe('TelegramSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows onboarding wizard when no config exists', async () => {
    botConfig.getBotConfig.mockResolvedValue(null)
    render(<TelegramSection />)
    await waitFor(() => {
      expect(screen.getByText('Conectar Bot Telegram')).toBeTruthy()
    })
  })

  it('shows connected state when config exists', async () => {
    botConfig.getBotConfig.mockResolvedValue({
      is_active: true,
      allowed_telegram_ids: ['123456'],
      confirmation_threshold: 500,
      telegram_bot_token: '••••••••••••••••••••••',
      llm_api_key: null,
    })
    render(<TelegramSection />)
    await waitFor(() => {
      expect(screen.getByText(/Ativo/)).toBeTruthy()
    })
  })

  it('calls updateBotConfig when pause button clicked', async () => {
    botConfig.getBotConfig.mockResolvedValue({
      is_active: true,
      allowed_telegram_ids: [],
      confirmation_threshold: 500,
      telegram_bot_token: '••••',
      llm_api_key: null,
    })
    botConfig.updateBotConfig.mockResolvedValue({ ok: true })
    render(<TelegramSection />)
    await waitFor(() => screen.getByText('Pausar'))
    fireEvent.click(screen.getByText('Pausar'))
    await waitFor(() => {
      expect(botConfig.updateBotConfig).toHaveBeenCalledWith({ is_active: false })
    })
  })
})
