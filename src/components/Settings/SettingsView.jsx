import { Suspense, lazy, useState } from 'react'
import DeferredSurface from '../shared/DeferredSurface.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

const MembersPage = lazy(() => import('../tenant/MembersPage.jsx'))
const AuditTimeline = lazy(() => import('../tenant/AuditTimeline.jsx'))
const BillingPage = lazy(() => import('../billing/BillingPage.jsx'))
const TelegramSection = lazy(() => import('./TelegramSection.jsx'))
const CommandsSection = lazy(() => import('./CommandsSection.jsx'))

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
        title="Configuracoes"
        subtitle="Gerencie membros, integracoes, auditoria e preferencias do workspace."
      />

      <PageTabs
        items={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Secoes de configuracoes"
      />

      <SurfaceCard className="settings-page__panel">
        <Suspense fallback={<DeferredSurface label="Carregando secao de configuracoes..." />}>
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
