import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useActivities } from '../../hooks/useActivities'
import { useActivityTemplates } from '../../hooks/useActivityTemplates'
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinRules } from '../../hooks/useFinRules'
import { useAccounts } from '../../hooks/useAccounts'
import { getPrincipalAccount } from '../../lib/financeUtils'
import ActivityTimeline from './ActivityTimeline'
import ActivityForm from './ActivityForm'
import TemplatesTab from './TemplatesTab'
import ActivityTemplateForm from './ActivityTemplateForm'
import CalendarView from '../Calendar/CalendarView'

const EMPTY_FILTERS = {}

const ActivitiesView = ({ clients = [], tasks = [], team = [], searchQuery = '' }) => {
  const { activities, loading, addActivity, updateActivity, deleteActivity } = useActivities()
  const { templates, createTemplate, updateTemplate, deleteTemplate, applyTemplate } = useActivityTemplates()
  const { createReceivableFromActivity } = useReceivables()
  const { rules } = useFinRules()
  const { addTransaction } = useTransactions(EMPTY_FILTERS, rules)
  const { accounts } = useAccounts()

  const [activeTab, setActiveTab] = useState('timeline')
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  const filteredActivities = activities.filter(activity => {
    if (!searchQuery) return true
    return (activity.title || '').toLowerCase().includes(searchQuery.toLowerCase())
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
      const { id, ...updates } = form
      saved = await updateActivity(editingActivity.id, updates)
    } else {
      saved = await addActivity(form)
    }
    if (!saved) return null  // error already logged by the hook; don't close the form
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

  // Template handlers
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
      <div className="activities-view">
        <div className="board-container">
          <p>Carregando atividades...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="activities-view">
      <div className="view-header">
        <h3>Atividades</h3>
        <div className="view-controls">
          <div className="actions">
            {activeTab === 'timeline' && (
              <button className="add-member-btn" onClick={handleOpenNew}>
                <Plus size={16} /> Nova Atividade
              </button>
            )}
            {activeTab === 'modelos' && (
              <button className="add-member-btn" onClick={handleNewTemplate}>
                <Plus size={16} /> Novo Modelo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
          onClick={() => setActiveTab('modelos')}
        >
          Modelos
        </button>
        <button
          className={`tab-btn ${activeTab === 'calendario' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendario')}
        >
          📅 Calendário
        </button>
      </div>

      <div className="board-container">
        {activeTab === 'timeline' && (
          <ActivityTimeline
            activities={filteredActivities}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
            onEdit={(activity) => { setEditingActivity(activity); setShowForm(true) }}
            emptyMessage="Nenhuma atividade encontrada."
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
      </div>

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
