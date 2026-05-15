import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useActivities } from '../../hooks/useActivities'
import { useActivityTemplates } from '../../hooks/useActivityTemplates'
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinRules } from '../../hooks/useFinRules'
import { useAccounts } from '../../hooks/useAccounts'
import { useTenant } from '../../hooks/useTenant.js'
import { getPrincipalAccount } from '../../lib/financeUtils'
import ActivityTimeline from './ActivityTimeline'
import ActivityForm from './ActivityForm'
import TemplatesTab from './TemplatesTab'
import ActivityTemplateForm from './ActivityTemplateForm'
import CalendarView from '../Calendar/CalendarView'
import ContextualHint from '../onboarding/ContextualHint.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

const EMPTY_FILTERS = {}
const ACTIVITY_TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'modelos', label: 'Modelos' },
  { id: 'calendario', label: 'Calendário' },
]

const ActivitiesView = ({
  clients = [],
  tasks = [],
  team = [],
  searchQuery = '',
  onSearch = () => {},
  onOpenTutorial = () => {},
  onTrackOnboarding = () => {},
  showTimelineHint = false,
  onDismissTimelineHint = () => {},
}) => {
  const { activeTenantId } = useTenant()
  const { activities, loading, addActivity, updateActivity, deleteActivity } = useActivities({ tenantId: activeTenantId })
  const { templates, createTemplate, updateTemplate, deleteTemplate, applyTemplate } = useActivityTemplates({ tenantId: activeTenantId })
  const { createReceivableFromActivity } = useReceivables({ tenantId: activeTenantId })
  const { rules } = useFinRules({ tenantId: activeTenantId })
  const { addTransaction } = useTransactions({ filters: EMPTY_FILTERS, rules, tenantId: activeTenantId })
  const { accounts } = useAccounts({ tenantId: activeTenantId })

  const [activeTab, setActiveTab] = useState('timeline')
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  const filteredActivities = useMemo(() => {
    const normalized = searchQuery.toLowerCase()
    return activities.filter((activity) => {
      if (!normalized) return true
      return (activity.title || '').toLowerCase().includes(normalized)
    })
  }, [activities, searchQuery])

  const metrics = [
    { label: 'Pendentes', value: String(activities.filter((activity) => activity.status === 'pending').length) },
    { label: 'Concluídas', value: String(activities.filter((activity) => activity.status === 'done').length) },
    { label: 'Modelos', value: String(templates.length) },
  ]

  const tabItems = ACTIVITY_TABS.map((tab) => {
    if (tab.id === 'timeline') return { ...tab, count: filteredActivities.length }
    if (tab.id === 'modelos') return { ...tab, count: templates.length }
    return tab
  })

  const handleToggleStatus = (id, newStatus) => {
    updateActivity(id, { status: newStatus })
  }

  const handleDelete = (id) => {
    deleteActivity(id)
  }

  const handleSave = async (form) => {
    let saved
    if (editingActivity) {
      saved = await updateActivity(editingActivity.id, form)
    } else {
      saved = await addActivity(form)
    }
    if (!saved) return null
    setShowForm(false)
    setEditingActivity(null)
    return saved
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingActivity(null)
  }

  const handleOpenNew = () => {
    setEditingActivity(null)
    setShowForm(true)
  }

  const handleApplyTemplate = (templateId) => {
    return applyTemplate(templateId)
  }

  const handleNewTemplate = () => {
    setEditingTemplate(null)
    setShowTemplateForm(true)
  }

  const handleEditTemplate = (template) => {
    setEditingTemplate(template)
    setShowTemplateForm(true)
  }

  const handleDeleteTemplate = async (id) => {
    await deleteTemplate(id)
  }

  const handleSaveTemplate = async (formData) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, formData)
    } else {
      await createTemplate(formData)
    }
    setShowTemplateForm(false)
    setEditingTemplate(null)
  }

  const handleCloseTemplateForm = () => {
    setShowTemplateForm(false)
    setEditingTemplate(null)
  }

  if (loading) {
    return (
      <div className="activities-page">
        <PageHeader
          eyebrow="Operação"
          title="Atividades"
          subtitle="Carregando timeline operacional do espaço de trabalho."
        />
      </div>
    )
  }

  return (
    <div className="activities-page">
      <PageHeader
        eyebrow="Operação"
        title="Atividades"
        subtitle="Acompanhe follow-ups, cadência comercial e próximos movimentos em uma timeline compacta."
        metrics={metrics}
      />

      <PageTabs
        items={tabItems}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Áreas de atividades"
      />

      <PageActionBar
        searchValue={activeTab === 'calendario' ? undefined : searchQuery}
        onSearch={activeTab === 'calendario' ? undefined : onSearch}
        primaryAction={
          activeTab === 'timeline'
            ? { label: 'Nova atividade', onClick: handleOpenNew }
            : activeTab === 'modelos'
              ? { label: 'Novo modelo', onClick: handleNewTemplate }
              : null
        }
        meta={
          activeTab === 'timeline'
            ? `${filteredActivities.length} ${filteredActivities.length === 1 ? 'atividade' : 'atividades'}`
            : activeTab === 'modelos'
              ? `${templates.length} ${templates.length === 1 ? 'modelo' : 'modelos'}`
              : null
        }
      />

      {activeTab === 'timeline' && showTimelineHint && filteredActivities.length === 0 ? (
        <ContextualHint
          title="A timeline ganha ritmo quando o time registra os primeiros follow-ups"
          description="Use atividades para alimentar histórico, agenda e próximos passos sem depender de notas soltas."
          actionLabel="Abrir tutorial"
          onAction={() => {
            onTrackOnboarding('empty_state_cta_clicked', {
              surface: 'activities.timeline',
              actionId: 'tutorial',
            })
            onOpenTutorial()
          }}
          onDismiss={onDismissTimelineHint}
        />
      ) : null}

      <SurfaceCard className="activities-page__surface" padded={activeTab !== 'timeline'}>
        {activeTab === 'timeline' && (
          <ActivityTimeline
            activities={filteredActivities}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
            onEdit={(activity) => { setEditingActivity(activity); setShowForm(true) }}
            emptyMessage="Nenhuma atividade corresponde à busca atual."
          />
        )}

        {activeTab === 'modelos' && (
          <TemplatesTab
            templates={templates}
            onNew={handleNewTemplate}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
          />
        )}

        {activeTab === 'calendario' && (
          <CalendarView
            filterTypes={['activity']}
            contextArea="atividades"
            clients={clients}
            tasks={tasks}
            team={team}
          />
        )}
      </SurfaceCard>

      <AnimatePresence>
        {showForm && (
          <ActivityForm
            activity={editingActivity}
            onSave={handleSave}
            onClose={handleClose}
            clients={clients}
            tasks={tasks}
            team={team}
            templates={templates}
            onApplyTemplate={handleApplyTemplate}
            addTransaction={addTransaction}
            createReceivableFromActivity={createReceivableFromActivity}
            principalAccountId={getPrincipalAccount(accounts)?.id ?? null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateForm && (
          <ActivityTemplateForm
            template={editingTemplate}
            onSave={handleSaveTemplate}
            onClose={handleCloseTemplateForm}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ActivitiesView
