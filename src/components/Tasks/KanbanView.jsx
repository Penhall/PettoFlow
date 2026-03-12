import { motion } from 'framer-motion'
import { Plus, Trash2, ArrowRight } from 'lucide-react'

const STATUSES = ['A Fazer', 'Em Progresso', 'Concluído']

const TAG_CLASS = {
  '#pesquisa': 'pesquisa',
  '#ux': 'ux',
  '#urgent': 'urgent',
  '#system': 'system',
  '#design': 'design',
}

const PRIORITY_CLASS = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }

const getTagClass = (tag) => TAG_CLASS[tag.toLowerCase()] ?? 'default-tag'

const KanbanView = ({ tasks, onAddTask, onUpdateTask, onDeleteTask }) => {
  const getNextStatus = (current) => {
    const idx = STATUSES.indexOf(current)
    return STATUSES[(idx + 1) % STATUSES.length]
  }

  return (
    <div className="kanban-board">
      {STATUSES.map((status) => {
        const columnTasks = tasks.filter(t => t.status === status)
        return (
          <div key={status} className="kanban-column">
            <div className="column-header">
              <h3>{status}</h3>
              <span className="task-count">{columnTasks.length}</span>
              <button className="add-task-btn" onClick={() => onAddTask(status)}>
                <Plus size={14} />
              </button>
            </div>

            {columnTasks.map(task => (
              <motion.div
                key={task.id}
                className={`task-card ${task.progress === 100 ? 'completed' : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                transition={{ duration: 0.2 }}
              >
                <div className="card-top">
                  <div className="tags">
                    {task.tags && task.tags.map(tag => (
                      <span key={tag} className={`tag ${getTagClass(tag)}`}>{tag}</span>
                    ))}
                  </div>
                  <button className="delete-task-btn" onClick={() => onDeleteTask(task.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <h4>{task.title}</h4>
                <div className="task-meta">
                  <span className="task-owner">{task.owner}</span>
                  <div className="task-actions-row">
                    <span className={`priority-badge priority-${PRIORITY_CLASS[task.priority]}`}>
                      {task.priority}
                    </span>
                    <button 
                      className="status-cycle-btn" 
                      onClick={() => onUpdateTask(task.id, { status: getNextStatus(task.status) })}
                      title="Mudar Status"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="progress-bar">
                    <span>{task.progress}%</span>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {columnTasks.length === 0 && (
              <div className="empty-column">
                <p>Nenhuma tarefa</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default KanbanView
