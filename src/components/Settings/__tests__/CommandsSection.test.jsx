import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CommandsSection from '../CommandsSection.jsx'

vi.mock('../../../lib/botCommands.js', () => ({
  listCommands: vi.fn().mockResolvedValue({ commands: [] }),
  toggleCommand: vi.fn(),
  deleteCommand: vi.fn(),
  seedDefaultCommands: vi.fn(),
}))

vi.mock('../../../hooks/useTenant.js', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1' }),
}))

describe('CommandsSection', () => {
  it('mostra opcao de instalar comandos padrao quando lista vazia', async () => {
    render(<CommandsSection />)

    await waitFor(() => {
      expect(screen.getByText(/Instalar comandos padrão/i)).toBeTruthy()
    })
  })
})
