// src/components/Activities/ActivityTimeline.jsx
import { AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import ActivityCard from './ActivityCard'

const ActivityTimeline = ({ activities, onToggleStatus, onDelete, emptyMessage }) => {
  if (!activities || activities.length === 0) {
    return (
      <div className="timeline-empty">
        <Activity size={28} />
        <p>{emptyMessage || 'Nenhuma atividade registrada ainda.'}</p>
      </div>
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
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ActivityTimeline
