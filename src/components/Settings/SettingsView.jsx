// src/components/Settings/SettingsView.jsx
import { useState } from 'react'
import TelegramSection from './TelegramSection.jsx'
import CommandsSection from './CommandsSection.jsx'
import BotAdminGate from './BotAdminGate.jsx'

const TABS = [
  { id: 'telegram', label: '🤖 Telegram' },
  { id: 'commands', label: '⚡ Comandos' },
]

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('telegram')

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 4px' }}>Configurações</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Gerencie integrações e preferências do PettoFlow
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

      <BotAdminGate>
        {activeTab === 'telegram' && <TelegramSection />}
        {activeTab === 'commands' && <CommandsSection />}
      </BotAdminGate>
    </div>
  )
}
