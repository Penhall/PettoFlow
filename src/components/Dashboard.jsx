const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }

const Dashboard = ({ tasks }) => {
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'Concluído').length
  const inProgress = tasks.filter(t => t.status === 'Em Progresso').length
  const todo = tasks.filter(t => t.status === 'A Fazer').length
  const avgProgress = total ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0

  return (
    <div className="dashboard-view">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total de Tarefas</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Concluídas</span>
          <span className="stat-value success">{done}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Em Progresso</span>
          <span className="stat-value warning">{inProgress}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">A Fazer</span>
          <span className="stat-value">{todo}</span>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Progresso Geral do Projeto</h3>
        <div className="big-progress">
          <div className="big-progress-track">
            <div className="big-progress-fill" style={{ width: `${avgProgress}%` }} />
          </div>
          <span>{avgProgress}%</span>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Tarefas Recentes</h3>
        <div className="recent-tasks">
          {tasks.map(task => (
            <div key={task.id} className="recent-task-row">
              <span>{task.title}</span>
              <span className={`status-badge ${STATUS_CLASS[task.status]}`}>{task.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
