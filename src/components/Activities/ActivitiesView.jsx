import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useActivities } from '../../hooks/useActivities'
import ActivityTimeline from './ActivityTimeline'
import ActivityForm from './ActivityForm'

const ActivitiesView = ({ clients = [], tasks = [], team = [], searchQuery = '' }) => {
  const { activities, loading, addActivity, updateActivity, deleteActivity } = useActivities()
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)

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
    if (editingActivity) {
      const { id, ...updates } = form
      await updateActivity(editingActivity.id, updates)
    } else {
      await addActivity(form)
    }
    setShowForm(false)
    setEditingActivity(null)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingActivity(null)
  }

  const handleOpenNew = () => {
    setEditingActivity(null)
    setShowForm(true)
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
            <button className="add-member-btn" onClick={handleOpenNew}>
              <Plus size={16} /> Nova Atividade
            </button>
          </div>
        </div>
      </div>

      <div className="board-container">
        <ActivityTimeline
          activities={filteredActivities}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          onEdit={(activity) => { setEditingActivity(activity); setShowForm(true) }}
          emptyMessage="Nenhuma atividade encontrada."
        />
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ActivitiesView
