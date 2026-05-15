import { Suspense, useState } from 'react'
import DeferredSurface from '../shared/DeferredSurface.jsx'
import ContextualHint from '../onboarding/ContextualHint.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'
import WorkspaceOnboarding from '../tenant/WorkspaceOnboarding.jsx'
import { lazyWithRetry } from '../../lib/lazyWithRetry.js'
import { useTenant } from '../../hooks/useTenant.js'

const MembersPage = lazyWithRetry(() => import('../tenant/MembersPage.jsx'), 'settings-members')
const AuditTimeline = lazyWithRetry(() => import('../tenant/AuditTimeline.jsx'), 'settings-audit')
const BillingPage = lazyWithRetry(() => import('../billing/BillingPage.jsx'), 'settings-billing')
const MfaSetup = lazyWithRetry(() => import('../auth/MfaSetup.jsx'), 'settings-security')
const TelegramSection = lazyWithRetry(() => import('./TelegramSection.jsx'), 'settings-telegram')
const CommandsSection = lazyWithRetry(() => import('./CommandsSection.jsx'), 'settings-commands')

const TABS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'members', label: 'Membros' },
  { id: 'billing', label: 'Faturamento' },
  { id: 'security', label: 'Segurança' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'commands', label: 'Comandos' },
]

export default function SettingsView({
  initialTab = 'members',
  showHint = false,
  onDismissHint = () => {},
  onOpenTutorial = () => {},
  onTrackOnboarding = () => {},
}) {
  const { hasTenant } = useTenant()
  const defaultTab = TABS.some((tab) => tab.id === initialTab) ? initialTab : (hasTenant ? 'members' : 'workspace')
  const [activeTab, setActiveTab] = useState(defaultTab)

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

      {showHint ? (
        <ContextualHint
          title="Configurações ficam mais fáceis quando a equipe entra por contexto"
          description="Comece por membros e faturamento, depois avance para auditoria, Telegram e comandos."
          actionLabel="Abrir tutorial"
          onAction={() => {
            onTrackOnboarding('empty_state_cta_clicked', {
              surface: 'settings.hint',
              actionId: 'tutorial',
            })
            onOpenTutorial()
          }}
          onDismiss={onDismissHint}
        />
      ) : null}

      <SurfaceCard className="settings-page__panel">
        {activeTab === 'workspace' && <WorkspaceOnboarding embed />}
        <Suspense fallback={<DeferredSurface label="Carregando seção de configurações..." />}>
          {activeTab === 'members' && <MembersPage />}
          {activeTab === 'billing' && <BillingPage />}
          {activeTab === 'security' && <MfaSetup />}
          {activeTab === 'audit' && <AuditTimeline />}
          {activeTab === 'telegram' && <TelegramSection />}
          {activeTab === 'commands' && <CommandsSection />}
        </Suspense>
      </SurfaceCard>
    </div>
  )
}
