import { TrendingUp, CheckCircle, Clock, AlertCircle, BarChart, PieChart, Users, DollarSign } from 'lucide-react'

const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }

const Dashboard = ({ tasks }) => {
  const activeTasks = tasks.filter(t => t.status !== 'Concluído').length
  const completedTasks = tasks.filter(t => t.status === 'Concluído').length
  const lateTasks = tasks.filter(t => t.status === 'A Fazer' && t.progress === 0).length
  const totalMembers = [...new Set(tasks.map(t => t.owner).filter(Boolean))].length

  const pipelineValue = tasks.filter(t => t.status !== 'Concluído').reduce((sum, t) => sum + Number(t.deal_value || 0), 0)
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)

  const statCards = [
    { label: 'Valor em Pipeline', value: formatCurrency(pipelineValue), icon: DollarSign, color: '#05CD99' },
    { label: 'Tarefas Ativas', value: activeTasks, icon: Clock, color: '#7C3AED' },
    { label: 'Sem Início', value: lateTasks, icon: AlertCircle, color: '#EE5D50' },
    { label: 'Time Envolvido', value: totalMembers, icon: Users, color: '#FFB547' },
  ]

  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0

  // Group tasks by tag for pie-like display
  const tagCounts = (tasks || []).flatMap(t => t.tags || []).reduce((acc, tag) => {
    if (tag) {
      acc[tag] = (acc[tag] || 0) + 1
    }
    return acc
  }, {})

  return (
    <div className="dashboard-view">
      <div className="stats-grid">
        {statCards.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
            <div className="stat-trend">
              <TrendingUp size={14} />
              <span>atualizado</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="card-header">
            <h3>Progresso Geral</h3>
            <BarChart size={20} />
          </div>
          <div className="big-progress" style={{ marginTop: 16 }}>
            <div className="big-progress-track">
              <div className="big-progress-fill" style={{ width: `${avgProgress}%` }} />
            </div>
            <span>{avgProgress}%</span>
          </div>
          <div className="chart-bars">
            {tasks.map(task => (
              <div key={task.id} className="chart-bar-item">
                <div className="chart-bar-label">{task.title.split(' ').slice(0, 2).join(' ')}</div>
                <div className="bar-track" style={{ flex: 1 }}>
                  <div className="bar-fill" style={{ width: `${task.progress}%` }} />
                </div>
                <span className="chart-bar-pct">{task.progress}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <h3>Distribuição por Tags</h3>
            <PieChart size={20} />
          </div>
          <div className="tag-distribution">
            {Object.entries(tagCounts).map(([tag, count]) => (
              <div key={tag} className="bar-row">
                <span>{tag}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(count / tasks.length) * 100}%` }} />
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Tarefas Recentes</h3>
        <div className="recent-tasks">
          {(tasks || []).slice(0, 5).map(task => (
            <div key={task.id} className="recent-task-row">
              <div className="activity-avatar">
                {task.owner ? task.owner.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
              </div>
              <span className="recent-task-title">{task.title || 'Sem título'}</span>
              <span className={`status-badge ${STATUS_CLASS[task.status] || 'todo'}`}>
                {task.status || 'A Fazer'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
