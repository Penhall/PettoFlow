import AppShell from '../components/shell/AppShell.jsx'
import ProfileMenu from '../components/shell/ProfileMenu.jsx'
import SidebarRail from '../components/shell/SidebarRail.jsx'
import Topbar from '../components/shell/Topbar.jsx'
import ActivitiesView from '../components/Activities/ActivitiesView.jsx'
import CalendarWorkspacePage from '../components/Calendar/CalendarWorkspacePage.jsx'
import ClientProfileModal from '../components/Clients/ClientProfileModal.jsx'
import ClientesView from '../components/Clients/ClientesView.jsx'
import Dashboard from '../components/Dashboard/Dashboard.jsx'
import FinanceView from '../components/Finance/FinanceView.jsx'
import SettingsView from '../components/Settings/SettingsView.jsx'
import KanbanView from '../components/Tasks/KanbanView.jsx'
import TasksPage from '../components/Tasks/TasksPage.jsx'
import TimeView from '../components/Team/TimeView.jsx'
import RecordSidebar from '../components/shared/RecordSidebar.jsx'
import { VISUAL_FIXTURES } from './fixtures.js'

if (typeof window !== 'undefined') {
  window.__NEXUS_VISUAL_FIXTURES__ = VISUAL_FIXTURES
}

const SURFACE_TABS = {
  dashboard: 'dashboard',
  tasks: 'tarefas',
  finance: 'financas',
  activities: 'atividades',
  team: 'time',
  clients: 'clientes',
  calendar: 'calendario',
  settings: 'settings',
  recordSidebar: 'clientes',
  clientProfileModal: 'clientes',
}

function readSurface() {
  if (typeof window === 'undefined') return 'dashboard'
  const url = new URL(window.location.href)
  return url.searchParams.get('surface') || 'dashboard'
}

function ShellFrame({ activeTab, children }) {
  return (
    <AppShell
      sidebar={(
        <SidebarRail
          activeTab={activeTab}
          onChange={() => {}}
          collapsed={false}
          mobileOpen={false}
          onMobileClose={() => {}}
        />
      )}
      topbar={(
        <Topbar
          searchQuery=""
          onSearch={() => {}}
          searchPlaceholder="Pesquisar"
          showSearch
          onMenuToggle={() => {}}
          profileMenu={<ProfileMenu user={{ email: 'ops@nexuscrm.test' }} onSignOut={() => {}} />}
        />
      )}
    >
      <div className="visual-regression-frame">
        {children}
      </div>
    </AppShell>
  )
}

export default function VisualRegressionApp() {
  const surface = readSurface()
  const activeTab = SURFACE_TABS[surface] || 'dashboard'
  const { tasks, columns, clients, team } = VISUAL_FIXTURES

  let content = <Dashboard tasks={tasks} columns={columns} />

  if (surface === 'tasks') {
    content = (
      <TasksPage
        viewType="kanban"
        setViewType={() => {}}
        searchQuery=""
        onSearch={() => {}}
        sortBy={null}
        setSortBy={() => {}}
        filterTag={null}
        setFilterTag={() => {}}
        allTags={['Renovacao', 'Implantacao', 'Onboarding', 'Financeiro']}
        showSortMenu={false}
        setShowSortMenu={() => {}}
        showFilterMenu={false}
        setShowFilterMenu={() => {}}
        onCreateTask={() => {}}
        taskCount={tasks.length}
        content={(
          <div className="board-container">
            <KanbanView
              tasks={tasks}
              columns={columns}
              onAddTask={() => {}}
              onUpdateTask={() => {}}
              onDeleteTask={() => {}}
              onEditTask={() => {}}
              onAddColumn={() => {}}
              onDeleteColumn={() => {}}
              onArchive={() => {}}
            />
          </div>
        )}
      />
    )
  }

  if (surface === 'finance') {
    content = <FinanceView clients={clients} tasks={tasks} team={team} onAddTask={() => {}} columns={columns} />
  }

  if (surface === 'activities') {
    content = <ActivitiesView clients={clients} tasks={tasks} team={team} searchQuery="" onSearch={() => {}} />
  }

  if (surface === 'team') {
    content = <TimeView tasks={tasks} team={team} onRefresh={() => {}} searchQuery="" />
  }

  if (surface === 'clients') {
    content = <ClientesView clients={clients} tasks={tasks} onRefresh={() => {}} searchQuery="" />
  }

  if (surface === 'calendar') {
    content = <CalendarWorkspacePage tasks={tasks} clients={clients} team={team} columns={columns} onUpdateTask={() => {}} onAddTask={() => {}} />
  }

  if (surface === 'settings') {
    content = <SettingsView initialTab="members" />
  }

  if (surface === 'recordSidebar') {
    content = (
      <RecordSidebar isOpen title="Atlas Bio" subtitle="Saude · Ativo" onClose={() => {}}>
        <div className="client-profile-card">
          <div className="client-profile-card__header">
            <div>
              <span className="client-profile-card__eyebrow">Preview</span>
              <h3>Contexto rapido</h3>
            </div>
          </div>
          <p className="client-profile-card__empty">Visual regression safety para sidebars operacionais.</p>
        </div>
      </RecordSidebar>
    )
  }

  if (surface === 'clientProfileModal') {
    content = (
      <ClientProfileModal
        isOpen
        client={clients[0]}
        clientTasks={tasks.filter((task) => task.client_id === clients[0].id)}
        onEdit={() => {}}
        onClose={() => {}}
      />
    )
  }

  return <ShellFrame activeTab={activeTab}>{content}</ShellFrame>
}
