// src/components/Activities/ActivityTimeline.jsx
import { AnimatePresence } from 'framer-motion'
import ActivityCard from './ActivityCard'
import EmptyState from '../shared/EmptyState.jsx'

const ActivityTimeline = ({ activities, onToggleStatus, onDelete, onEdit, emptyMessage }) => {
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
        <AnimatePresence>
          {activities.map(activity => (
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
    </div>
  )
}

export default ActivityTimeline
