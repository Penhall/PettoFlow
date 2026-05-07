import { AlertCircle, BarChart, DollarSign, PieChart, Users } from 'lucide-react'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

const STATUS_CLASS = {
  'A Fazer': 'todo',
  'Em Progresso': 'progress',
  Concluido: 'done',
  'Concluído': 'done',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function getStatusClass(status) {
  return STATUS_CLASS[status] || 'todo'
}

export default function Dashboard({ tasks = [], columns = [] }) {
  const doneColumnName = columns.length > 0 ? columns[columns.length - 1].name : 'Concluido'
  const firstColumnName = columns.length > 0 ? columns[0].name : 'A Fazer'
  const activeTasks = tasks.filter((task) => task.status !== doneColumnName)
  const stalledTasks = tasks.filter((task) => task.status === firstColumnName && Number(task.progress || 0) === 0)
  const totalMembers = [...new Set(tasks.map((task) => task.owner).filter(Boolean))].length
  const pipelineValue = activeTasks.reduce((sum, task) => sum + Number(task.deal_value || 0), 0)
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / tasks.length)
    : 0

  const statusCounts = columns.map((column) => ({
    id: column.id ?? column.name,
    label: column.name,
    value: tasks.filter((task) => task.status === column.name).length,
  }))

  const tagCounts = Object.entries(
    tasks.flatMap((task) => task.tags || []).reduce((accumulator, tag) => {
      if (tag) {
        accumulator[tag] = (accumulator[tag] || 0) + 1
      }
      return accumulator
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)

  const recentTasks = [...tasks]
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .slice(0, 6)

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        subtitle="Acompanhe capacidade, ritmo de entrega e sinais recentes do workspace em uma leitura objetiva."
        metrics={[
          { label: 'Pipeline ativo', value: formatCurrency(pipelineValue), icon: DollarSign },
          { label: 'Tarefas ativas', value: String(activeTasks.length) },
          { label: 'Sem inicio', value: String(stalledTasks.length), icon: AlertCircle },
          { label: 'Time envolvido', value: String(totalMembers), icon: Users },
        ]}
      />

      <PageActionBar meta={`${tasks.length} ${tasks.length === 1 ? 'tarefa monitorada' : 'tarefas monitoradas'}`} />

      {tasks.length === 0 ? (
        <SurfaceCard className="dashboard-page__empty">
          <EmptyState
            title="O dashboard aparece quando a operacao comeca a ganhar volume"
            description="Acompanhe pipeline, capacidade e gargalos do workspace em uma camada unica."
            detail="Esta area esta vazia porque ainda nao existem tarefas suficientes para formar uma leitura operacional."
          />
        </SurfaceCard>
      ) : (
        <div className="dashboard-page__content">
          <SurfaceCard className="dashboard-page__hero">
            <div className="dashboard-page__hero-copy">
              <span className="dashboard-page__kicker">Leitura do ciclo atual</span>
              <strong className="dashboard-page__headline">{avgProgress}% de progresso medio</strong>
              <p className="dashboard-page__summary">
                {activeTasks.length} frentes seguem em andamento e {stalledTasks.length} ainda precisam sair do zero.
              </p>
            </div>

            <div className="dashboard-page__hero-stages" role="list" aria-label="Resumo por etapa">
              {statusCounts.map((item) => (
                <div key={item.id} className="dashboard-stage-pill" role="listitem">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <div className="dashboard-page__grid">
            <SurfaceCard className="dashboard-panel">
              <div className="dashboard-panel__header">
                <div>
                  <span className="dashboard-panel__eyebrow">Execucao</span>
                  <h2>Progresso por tarefa</h2>
                </div>
                <BarChart size={18} strokeWidth={1.75} />
              </div>

              <div className="dashboard-progress-list">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="dashboard-progress-row">
                    <div className="dashboard-progress-row__copy">
                      <strong>{task.title || 'Sem titulo'}</strong>
                      <span>{task.owner || task.client_name || 'Sem responsavel definido'}</span>
                    </div>
                    <div className="dashboard-progress-row__bar" aria-hidden="true">
                      <div
                        className="dashboard-progress-row__fill"
                        style={{ '--progress-width': `${Math.max(0, Math.min(Number(task.progress || 0), 100))}%` }}
                      />
                    </div>
                    <strong className="dashboard-progress-row__value">{Number(task.progress || 0)}%</strong>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="dashboard-panel">
              <div className="dashboard-panel__header">
                <div>
                  <span className="dashboard-panel__eyebrow">Foco</span>
                  <h2>Tags em circulacao</h2>
                </div>
                <PieChart size={18} strokeWidth={1.75} />
              </div>

              {tagCounts.length ? (
                <div className="dashboard-tag-list">
                  {tagCounts.map(([tag, count]) => {
                    const share = Math.max(8, Math.round((count / Math.max(tasks.length, 1)) * 100))
                    return (
                      <div key={tag} className="dashboard-tag-row">
                        <div className="dashboard-tag-row__copy">
                          <strong>{tag}</strong>
                          <span>{count} ocorrencias</span>
                        </div>
                        <div className="dashboard-tag-row__bar" aria-hidden="true">
                          <div className="dashboard-tag-row__fill" style={{ '--progress-width': `${share}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-panel__placeholder">
                  <p>As tags passam a aparecer aqui quando as tarefas comecarem a usar classificacao contextual.</p>
                </div>
              )}
            </SurfaceCard>
          </div>

          <SurfaceCard className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div>
                <span className="dashboard-panel__eyebrow">Movimento recente</span>
                <h2>Tarefas mais recentes</h2>
              </div>
            </div>

            <div className="dashboard-recent-list">
              {recentTasks.map((task) => (
                <div key={task.id} className="dashboard-recent-row">
                  <div className="dashboard-recent-row__identity">
                    <span className="dashboard-recent-row__avatar">
                      {task.owner ? task.owner.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : 'WS'}
                    </span>
                    <div className="dashboard-recent-row__copy">
                      <strong>{task.title || 'Sem titulo'}</strong>
                      <span>{task.owner || task.client_name || 'Sem responsavel definido'}</span>
                    </div>
                  </div>
                  <span className={`status-badge ${getStatusClass(task.status)}`}>
                    {task.status || 'A Fazer'}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
