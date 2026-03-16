// src/components/Activities/ActivityCard.jsx
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Trash2, AlertTriangle } from 'lucide-react'

const TYPE_COLORS = {
  meeting:  '#7C3AED',
  call:     '#05CD99',
  email:    '#3B82F6',
  whatsapp: '#22C55E',
  note:     '#F59E0B',
  task:     '#EF4444',
}

const TYPE_LABELS = {
  meeting: 'Reunião', call: 'Ligação', email: 'Email',
  whatsapp: 'WhatsApp', note: 'Nota', task: 'Tarefa',
}

const extractText = (body) => {
  if (!body) return null
  try {
    const doc = typeof body === 'string' ? JSON.parse(body) : body
    const texts = []
    const walk = (node) => {
      if (node.type === 'text') texts.push(node.text)
      if (node.content) node.content.forEach(walk)
    }
    walk(doc)
    return texts.join(' ').slice(0, 120) || null
  } catch { return null }
}

const ActivityCard = ({ activity, onToggleStatus, onDelete }) => {
  const isDone = activity.status === 'completed'
  const color = TYPE_COLORS[activity.type] || '#94A3B8'
  const preview = extractText(activity.body)

  return (
    <motion.div
      className={`activity-card ${isDone ? 'activity-done' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="activity-card-header">
        <span className="activity-type-badge" style={{ background: `${color}20`, color }}>
          {TYPE_LABELS[activity.type] || activity.type}
        </span>
        <span className="activity-date">
          {activity.scheduled_at
            ? new Date(activity.scheduled_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })
            : new Date(activity.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short'
              })
          }
        </span>
        {activity.created_by && (
          <span className="activity-author">· {activity.created_by}</span>
        )}
      </div>

      <div className="activity-card-body">
        <h4 className={isDone ? 'line-through' : ''}>{activity.title}</h4>
        {preview && <p className="activity-preview">{preview}</p>}
      </div>

      {Array.isArray(activity.related_to) && activity.related_to.length > 0 && (
        <div className="activity-chips">
          {activity.related_to.map((r, i) => (
            <span key={i} className="activity-chip">
              {r.label}
              {!r.id && <AlertTriangle size={10} style={{ marginLeft: 4, color: 'var(--warning)' }} />}
            </span>
          ))}
        </div>
      )}

      <div className="activity-card-actions">
        <button
          className="icon-btn sm"
          onClick={() => onToggleStatus(activity.id, isDone ? 'pending' : 'completed')}
          title={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          {isDone ? <CheckCircle size={15} style={{ color: 'var(--success)' }} /> : <Circle size={15} />}
        </button>
        <button className="icon-btn sm danger" onClick={() => onDelete(activity.id)} title="Excluir">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

export default ActivityCard
