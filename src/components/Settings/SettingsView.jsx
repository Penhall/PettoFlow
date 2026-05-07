import { Suspense, useState } from 'react'
import DeferredSurface from '../shared/DeferredSurface.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'
import { lazyWithRetry } from '../../lib/lazyWithRetry.js'

const MembersPage = lazyWithRetry(() => import('../tenant/MembersPage.jsx'), 'settings-members')
const AuditTimeline = lazyWithRetry(() => import('../tenant/AuditTimeline.jsx'), 'settings-audit')
const BillingPage = lazyWithRetry(() => import('../billing/BillingPage.jsx'), 'settings-billing')
const TelegramSection = lazyWithRetry(() => import('./TelegramSection.jsx'), 'settings-telegram')
const CommandsSection = lazyWithRetry(() => import('./CommandsSection.jsx'), 'settings-commands')

const TABS = [
  { id: 'members', label: 'Membros' },
  { id: 'billing', label: 'Faturamento' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'commands', label: 'Comandos' },
]

export default function SettingsView({ initialTab = 'members' }) {
  const [activeTab, setActiveTab] = useState(TABS.some((tab) => tab.id === initialTab) ? initialTab : 'members')

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="Espaço de trabalho"
        title="Configurações"
        subtitle="Gerencie membros, integrações, auditoria e preferências do espaço de trabalho."
      />

      <PageTabs
        items={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Seções de configurações"
      />

      <SurfaceCard className="settings-page__panel">
        <Suspense fallback={<DeferredSurface label="Carregando seção de configurações..." />}>
          {activeTab === 'members' && <MembersPage />}
          {activeTab === 'billing' && <BillingPage />}
          {activeTab === 'audit' && <AuditTimeline />}
          {activeTab === 'telegram' && <TelegramSection />}
          {activeTab === 'commands' && <CommandsSection />}
        </Suspense>
      </SurfaceCard>
    </div>
  )
}
