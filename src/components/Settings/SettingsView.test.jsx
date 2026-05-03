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
  it('exibe a aba de membros e renderiza a tela correspondente', () => {
    render(<SettingsView />)

    fireEvent.click(screen.getByRole('button', { name: /membros/i }))

    expect(screen.getByText('Members Page')).toBeInTheDocument()
  })

  it('aceita tab inicial para abrir billing diretamente', () => {
    render(<SettingsView initialTab="billing" />)

    expect(screen.getByText('Billing Page')).toBeInTheDocument()
  })
})
