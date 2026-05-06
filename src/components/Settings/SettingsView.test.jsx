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
  it('renderiza o cabecalho premium e as tabs semanticas de configuracoes', () => {
    render(<SettingsView />)

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
    expect(
      screen.getByText(/membros, integrações, auditoria e preferências do workspace/i)
    ).toBeInTheDocument()

    expect(screen.getByRole('tablist', { name: 'Seções de configurações' })).toBeInTheDocument()

    const membersTab = screen.getByRole('tab', { name: 'Membros' })
    expect(membersTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Members Page')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Telegram' }))

    expect(screen.getByRole('tab', { name: 'Telegram' })).toHaveAttribute('aria-selected', 'true')
    expect(membersTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Telegram Section')).toBeInTheDocument()
  })

  it('aceita tab inicial para abrir billing diretamente', () => {
    render(<SettingsView initialTab="billing" />)

    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Billing Page')).toBeInTheDocument()
  })
})
