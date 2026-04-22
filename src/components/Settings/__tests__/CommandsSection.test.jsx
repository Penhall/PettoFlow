// src/components/Settings/__tests__/CommandsSection.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CommandsSection from '../CommandsSection.jsx'
import * as botCommands from '../../../lib/botCommands.js'

vi.mock('../../../lib/botCommands.js')

const MOCK_COMMANDS = [
  {
    id: 'uuid-1',
    trigger: '/saldo',
    description: 'Consulta saldo das contas',
    type: 'builtin',
    actions: [],
    examples: ['Qual o saldo?', 'Ver saldo'],
    category: 'finance',
    is_active: true,
    is_default: true,
  },
  {
    id: 'uuid-2',
    trigger: '/cafe',
    description: 'Saída rápida: café R$8',
    type: 'shortcut',
    actions: [{ action: 'finance.record', params: { direction: 'out', description: 'café', amount: 8 } }],
    examples: [],
    category: 'custom',
    is_active: true,
    is_default: true,
  },
  {
    id: 'uuid-3',
    trigger: '/meu-cmd',
    description: 'Comando do usuário',
    type: 'shortcut',
    actions: [],
    examples: [],
    category: 'custom',
    is_active: true,
    is_default: false,
  },
]

describe('CommandsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    botCommands.listCommands.mockResolvedValue(MOCK_COMMANDS)
  })

  it('mostra loading enquanto carrega', () => {
    botCommands.listCommands.mockReturnValue(new Promise(() => {}))
    render(<CommandsSection />)
    expect(screen.getByText('Carregando comandos...')).toBeTruthy()
  })

  it('exibe built-in /saldo na aba Built-in', async () => {
    render(<CommandsSection />)
    await waitFor(() => expect(screen.getByText('/saldo')).toBeTruthy())
    expect(screen.getByText('Consulta saldo das contas')).toBeTruthy()
    expect(screen.getByText(/Qual o saldo\?/)).toBeTruthy()
  })

  it('exibe comandos custom na aba Personalizados', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => expect(screen.getByText('/cafe')).toBeTruthy())
    expect(screen.getByText('/meu-cmd')).toBeTruthy()
  })

  it('chama toggleCommand ao clicar no botão de pause', async () => {
    botCommands.toggleCommand.mockResolvedValue({ ...MOCK_COMMANDS[0], is_active: false })
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('/saldo'))
    const pauseButtons = screen.getAllByText('⏸')
    fireEvent.click(pauseButtons[0])
    await waitFor(() => {
      expect(botCommands.toggleCommand).toHaveBeenCalledWith('uuid-1', false)
    })
  })

  it('mostra botão de delete apenas para is_default = false', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => screen.getByText('/meu-cmd'))
    expect(screen.getByText('🗑')).toBeTruthy() // só /meu-cmd tem delete
  })

  it('chama deleteCommand após confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    botCommands.deleteCommand.mockResolvedValue({ ok: true })
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => screen.getByText('🗑'))
    fireEvent.click(screen.getByText('🗑'))
    await waitFor(() => {
      expect(botCommands.deleteCommand).toHaveBeenCalledWith('uuid-3')
    })
  })

  it('abre CommandForm ao clicar em + Novo', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('+ Novo'))
    fireEvent.click(screen.getByText('+ Novo'))
    expect(screen.getByText('Novo Comando')).toBeTruthy()
  })
})
