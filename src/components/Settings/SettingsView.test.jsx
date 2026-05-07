import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView.jsx'

vi.mock('./TelegramSection.jsx', () => ({
  default: () => <div>Telegram Section</div>,
}))

vi.mock('./CommandsSection.jsx', () => ({
  default: () => <div>Commands Section</div>,
}))

vi.mock('../tenant/MembersPage.jsx', () => ({
  default: () => <div>Members Page</div>,
}))

vi.mock('../billing/BillingPage.jsx', () => ({
  default: () => <div>Billing Page</div>,
}))

vi.mock('../tenant/AuditTimeline.jsx', () => ({
  default: () => <div>Audit Timeline</div>,
}))

describe('SettingsView', () => {
  it('renderiza o cabecalho premium e as tabs semanticas de configuracoes', async () => {
    render(<SettingsView />)

    expect(screen.getByRole('heading', { name: 'Configuracoes' })).toBeInTheDocument()
    expect(
      screen.getByText(/membros, integracoes, auditoria e preferencias do workspace/i)
    ).toBeInTheDocument()

    expect(screen.getByRole('tablist', { name: 'Secoes de configuracoes' })).toBeInTheDocument()

    const membersTab = screen.getByRole('tab', { name: 'Membros' })
    expect(membersTab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Members Page')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Telegram' }))

    expect(screen.getByRole('tab', { name: 'Telegram' })).toHaveAttribute('aria-selected', 'true')
    expect(membersTab).toHaveAttribute('aria-selected', 'false')
    expect(await screen.findByText('Telegram Section')).toBeInTheDocument()
  })

  it('aceita tab inicial para abrir billing diretamente', async () => {
    render(<SettingsView initialTab="billing" />)

    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Billing Page')).toBeInTheDocument()
  })
})
