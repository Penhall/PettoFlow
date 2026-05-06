import { useState } from 'react'
import MembersPage from '../tenant/MembersPage.jsx'
import AuditTimeline from '../tenant/AuditTimeline.jsx'
import BillingPage from '../billing/BillingPage.jsx'
import TelegramSection from './TelegramSection.jsx'
import CommandsSection from './CommandsSection.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

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
    <div className="settings-page">
      <PageHeader
        eyebrow="Workspace"
        title="Configurações"
        subtitle="Gerencie membros, integrações, auditoria e preferências do workspace."
      />

      <PageTabs
        items={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Seções de configurações"
      />

      <SurfaceCard className="settings-page__panel">
        {activeTab === 'members' && <MembersPage />}
        {activeTab === 'billing' && <BillingPage />}
        {activeTab === 'audit' && <AuditTimeline />}
        {activeTab === 'telegram' && <TelegramSection />}
        {activeTab === 'commands' && <CommandsSection />}
      </SurfaceCard>
    </div>
  )
}
