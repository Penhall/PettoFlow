const PRIORITY_FILL = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }

const OverviewView = ({ tasks }) => {
  const total = tasks.length
  const byStatus = {
    'A Fazer': tasks.filter(t => t.status === 'A Fazer').length,
    'Em Progresso': tasks.filter(t => t.status === 'Em Progresso').length,
    'Concluído': tasks.filter(t => t.status === 'Concluído').length,
  }
  const byPriority = {
    'Alta': tasks.filter(t => t.priority === 'Alta').length,
    'Média': tasks.filter(t => t.priority === 'Média').length,
    'Baixa': tasks.filter(t => t.priority === 'Baixa').length,
  }
  const avgProgress = total ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0

  return (
    <div className="overview-view">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total de Tarefas</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Progresso Médio</span>
          <span className="stat-value">{avgProgress}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Concluídas</span>
          <span className="stat-value success">{byStatus['Concluído']}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Em Progresso</span>
          <span className="stat-value warning">{byStatus['Em Progresso']}</span>
        </div>
      </div>

      <div className="overview-details">
        <div className="overview-section">
          <h3>Por Status</h3>
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} className="bar-row">
              <span>{status}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: total ? `${(count / total) * 100}%` : '0%' }} />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>

        <div className="overview-section">
          <h3>Por Prioridade</h3>
          {Object.entries(byPriority).map(([priority, count]) => (
            <div key={priority} className="bar-row">
              <span>{priority}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill priority-fill-${PRIORITY_FILL[priority]}`}
                  style={{ width: total ? `${(count / total) * 100}%` : '0%' }}
                />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OverviewView
