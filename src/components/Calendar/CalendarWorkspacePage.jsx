import { useState } from 'react'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'
import CalendarFilters from './CalendarFilters'
import CalendarView from './CalendarView.jsx'

const ALL_TYPES = ['task', 'activity', 'receivable', 'transaction']

export default function CalendarWorkspacePage({
  tasks = [],
  clients = [],
  team = [],
  columns = [],
  onUpdateTask,
  onAddTask,
}) {
  const [activeTypes, setActiveTypes] = useState(ALL_TYPES)
  const dueTaskCount = tasks.filter((task) => !task.completed_at).length
  const completedTaskCount = tasks.filter((task) => task.completed_at).length

  return (
    <div className="calendar-page">
      <PageHeader
        eyebrow="Espaço de trabalho"
        title="Calendário"
        subtitle="Centralize tarefas, atividades e sinais financeiros em uma agenda única do espaço de trabalho."
        metrics={[
          { label: 'Tarefas abertas', value: String(dueTaskCount) },
          { label: 'Concluídas', value: String(completedTaskCount) },
          { label: 'Clientes ativos', value: String(clients.length) },
          { label: 'Pessoas no time', value: String(team.length) },
        ]}
      />

      <PageActionBar meta="Agenda unificada com filtros por operação e financeiro">
        <CalendarFilters active={activeTypes} onChange={setActiveTypes} />
      </PageActionBar>

      <SurfaceCard className="calendar-page__surface" padded={false}>
        <CalendarView
          tasks={tasks}
          clients={clients}
          team={team}
          columns={columns}
          onUpdateTask={onUpdateTask}
          onAddTask={onAddTask}
          contextArea="global"
          activeTypes={activeTypes}
          onActiveTypesChange={setActiveTypes}
          showFilters={false}
        />
      </SurfaceCard>
    </div>
  )
}
