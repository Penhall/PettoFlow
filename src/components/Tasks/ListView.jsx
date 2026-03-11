const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }
const PRIORITY_CLASS = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }

const ListView = ({ tasks }) => {
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
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>
                <span className={`status-badge ${STATUS_CLASS[task.status]}`}>
                  {task.status}
                </span>
              </td>
              <td>
                <span className={`priority-badge priority-${PRIORITY_CLASS[task.priority]}`}>
                  {task.priority}
                </span>
              </td>
              <td>{task.owner}</td>
              <td>
                <div className="progress-bar-inline">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                  </div>
                  <span>{task.progress}%</span>
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
