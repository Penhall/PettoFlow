import { useState } from 'react'
import MembersPage from '../tenant/MembersPage.jsx'
import AuditTimeline from '../tenant/AuditTimeline.jsx'
import BillingPage from '../billing/BillingPage.jsx'
import TelegramSection from './TelegramSection.jsx'
import CommandsSection from './CommandsSection.jsx'

const TABS = [
  { id: 'members', label: 'Membros' },
  { id: 'billing', label: 'Billing' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'commands', label: 'Comandos' },
]

export default function SettingsView({ initialTab = 'members' }) {
  const [activeTab, setActiveTab] = useState(TABS.some((tab) => tab.id === initialTab) ? initialTab : 'members')

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 4px' }}>Configuracoes</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Gerencie membros, integracoes e preferencias do NexusCRM
      </p>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'members' && <MembersPage />}
      {activeTab === 'billing' && <BillingPage />}
      {activeTab === 'audit' && <AuditTimeline />}
      {activeTab === 'telegram' && <TelegramSection />}
      {activeTab === 'commands' && <CommandsSection />}
    </div>
  )
}
