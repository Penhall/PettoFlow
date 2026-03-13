import { Trash2, ArrowRight } from 'lucide-react'

const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }
const PRIORITY_CLASS = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }
const STATUSES = ['A Fazer', 'Em Progresso', 'Concluído']

const ListView = ({ tasks, onUpdateTask, onDeleteTask }) => {
  const getNextStatus = (current) => {
    const idx = STATUSES.indexOf(current)
    return STATUSES[(idx + 1) % STATUSES.length]
  }

  if (tasks.length === 0) {
    return <p className="no-results">Nenhuma tarefa encontrada.</p>
  }

  return (
    <div className="list-view">
      <table className="task-table">
        <thead>
          <tr>
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
              <td>{task.title || 'Sem título'}</td>
              <td>
                <span className={`status-badge ${STATUS_CLASS[task.status] || 'todo'}`}>
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
                    title="Próximo Status"
                  >
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    className="action-icon-btn sm danger" 
                    onClick={() => onDeleteTask(task.id)}
                    title="Excluir"
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
