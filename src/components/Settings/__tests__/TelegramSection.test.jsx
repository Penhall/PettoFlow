import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TelegramSection from '../TelegramSection.jsx'

vi.mock('../../../lib/botConfig.js', () => ({
  getBotConfig: vi.fn().mockResolvedValue({ config: null }),
  saveBotConfig: vi.fn(),
  updateBotConfig: vi.fn(),
  deleteBotConfig: vi.fn(),
}))

vi.mock('../../../lib/botCommands.js', () => ({
  seedDefaultCommands: vi.fn(),
}))

vi.mock('../../../hooks/useTenant.js', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1' }),
}))

describe('TelegramSection', () => {
  it('renderiza o estado inicial com opcao de configurar quando nao ha config', async () => {
    render(<TelegramSection />)

    await waitFor(() => {
      expect(screen.getByText(/Conectar Bot Telegram/i)).toBeTruthy()
    })
  })
})
