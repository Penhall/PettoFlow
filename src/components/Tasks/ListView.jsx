import { Trash2, ArrowRight } from 'lucide-react'

const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }
const PRIORITY_CLASS = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }

const ListView = ({
  tasks,
  columns = [],
  onUpdateTask,
  onDeleteTask,
  selectedTaskIds = new Set(),
  onSelectionChange,
  batchMode = false,
}) => {
  const orderedColumns = [...columns].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  const selectedIds = selectedTaskIds instanceof Set ? selectedTaskIds : new Set(selectedTaskIds)

  const getNextStatus = (current) => {
    if (!orderedColumns.length) return current
    const currentIndex = orderedColumns.findIndex((column) => column.name === current)

    if (currentIndex === -1) return orderedColumns[0]?.name || current

    return orderedColumns[(currentIndex + 1) % orderedColumns.length]?.name || current
  }

  const getStatusClass = (status) => {
    if (STATUS_CLASS[status]) return STATUS_CLASS[status]
    if (!orderedColumns.length) return 'todo'

    const currentIndex = orderedColumns.findIndex((column) => column.name === status)
    if (currentIndex <= 0) return 'todo'
    if (currentIndex === orderedColumns.length - 1) return 'done'
    return 'progress'
  }

  const toggleTaskSelection = (taskId) => {
    const next = new Set(selectedIds)
    if (next.has(taskId)) {
      next.delete(taskId)
    } else {
      next.add(taskId)
    }
    onSelectionChange?.(next)
  }

  return (
    <div className="list-view">
      <table className="task-table">
        <thead>
          <tr>
            {batchMode ? <th className="task-table__selection">Selecionar</th> : null}
            <th>Tarefa</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Responsável</th>
            <th>Progresso</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id}>
              {batchMode ? (
                <td className="task-table__selection">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleTaskSelection(task.id)}
                    aria-label={`Selecionar ${task.title || 'tarefa'}`}
                  />
                </td>
              ) : null}
              <td>{task.title || 'Sem título'}</td>
              <td>
                <span className={`status-badge ${getStatusClass(task.status)}`}>
                  {task.status || 'A Fazer'}
                </span>
              </td>
              <td>
                <span className={`priority-badge priority-${PRIORITY_CLASS[task.priority] || 'media'}`}>
                  {task.priority || 'Média'}
                </span>
              </td>
              <td>{task.owner || '-'}</td>
              <td>
                <div className="progress-bar-inline">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${task.progress || 0}%` }} />
                  </div>
                  <span>{task.progress || 0}%</span>
                </div>
              </td>
              <td>
                <div className="list-actions">
                  <button
                    className="action-icon-btn sm"
                    onClick={() => onUpdateTask(task.id, { status: getNextStatus(task.status) })}
                    title="Próximo status"
                    aria-label={`Avançar status de ${task.title || 'tarefa'}`}
                  >
                    <ArrowRight size={14} />
                  </button>
                  <button
                    className="action-icon-btn sm danger"
                    onClick={() => onDeleteTask(task.id)}
                    title="Excluir"
                    aria-label={`Excluir ${task.title || 'tarefa'}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ListView
