// src/components/Activities/ActivityTimeline.jsx
import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import ActivityCard from './ActivityCard'
import EmptyState from '../shared/EmptyState.jsx'

const getDateKey = (activity) => {
  const raw = activity.scheduled_at || activity.created_at
  if (!raw) return 'sem-data'
  const d = new Date(raw)
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateLabel = (activity) => {
  const raw = activity.scheduled_at || activity.created_at
  if (!raw) return 'Sem data'
  return new Date(raw).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

const ActivityTimeline = ({ activities, onToggleStatus, onDelete, onEdit, emptyMessage }) => {
  const grouped = useMemo(() => {
    const groups = []
    const seen = new Map()
    for (const activity of (activities || [])) {
      const key = getDateKey(activity)
      if (!seen.has(key)) {
        seen.set(key, groups.length)
        groups.push({ key, label: formatDateLabel(activity), items: [] })
      }
      groups[seen.get(key)].items.push(activity)
    }
    return groups
  }, [activities])

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        title="Nenhuma atividade encontrada"
        description="A timeline mostra cadência, responsáveis e próximos movimentos da operação em ordem temporal."
        detail={emptyMessage || 'Esta área está vazia porque ainda não existem atividades registradas.'}
      />
    )
  }

  return (
    <div className="activity-timeline">
      <div className="timeline-line" />
      <div className="timeline-items">
        {grouped.map(group => (
          <div key={group.key}>
            <div className="timeline-date-header">
              <span className="timeline-date-label">{group.label}</span>
            </div>
            <AnimatePresence>
              {group.items.map(activity => (
                <div key={activity.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <ActivityCard
                    activity={activity}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                </div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityTimeline
