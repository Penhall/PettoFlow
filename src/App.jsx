import { Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OnboardingPanel from './components/onboarding/OnboardingPanel.jsx'
import OnboardingTour from './components/onboarding/OnboardingTour.jsx'
import AppShell from './components/shell/AppShell.jsx'
import ProfileMenu from './components/shell/ProfileMenu.jsx'
import SidebarRail from './components/shell/SidebarRail.jsx'
import Topbar from './components/shell/Topbar.jsx'
import KanbanView from './components/Tasks/KanbanView.jsx'
import ListView from './components/Tasks/ListView.jsx'
import OverviewView from './components/Tasks/OverviewView.jsx'
import TasksPage from './components/Tasks/TasksPage.jsx'
import EmptyState from './components/shared/EmptyState.jsx'
import DeferredSurface from './components/shared/DeferredSurface.jsx'
import ViewErrorBoundary from './components/shared/ViewErrorBoundary.jsx'
import { useActivities } from './hooks/useActivities'
import { useAuth } from './hooks/useAuth.js'
import { useCommandPalette } from './hooks/useCommandPalette'
import { useOnboarding } from './hooks/useOnboarding.js'
import { useReceivables } from './hooks/useReceivables'
import { useTenant } from './hooks/useTenant.js'
import { shouldCreateReceivable, getPrincipalAccount as findPrincipal } from './lib/financeUtils'
import { lazyWithRetry } from './lib/lazyWithRetry.js'
import { traceAsyncFailure, traceBootstrap, traceRouteTransition } from './lib/diagnostics.js'
import { MOTION_TRANSITIONS } from './lib/motionTokens.js'
import { TUTORIAL_CATEGORIES } from './lib/tutorialCatalog.js'
import {
  archiveTaskRecord,
  createColumnRecord,
  createTaskRecord,
  deleteColumnRecord,
  deleteTaskRecord,
  fetchWorkspaceBootstrap,
  listActiveAccounts,
  restoreTaskRecord,
  updateTaskRecord,
} from './lib/workspaceCore'

const ActivitiesView = lazyWithRetry(() => import('./components/Activities/ActivitiesView.jsx'), 'activities')
const ArchiveView = lazyWithRetry(() => import('./components/Archive/ArchiveView.jsx'), 'archive')
const CalendarView = lazyWithRetry(() => import('./components/Calendar/CalendarView.jsx'), 'calendar-view')
const CalendarWorkspacePage = lazyWithRetry(() => import('./components/Calendar/CalendarWorkspacePage.jsx'), 'calendar-workspace')
const ClientesView = lazyWithRetry(() => import('./components/Clients/ClientesView.jsx'), 'clients')
const Dashboard = lazyWithRetry(() => import('./components/Dashboard/Dashboard.jsx'), 'dashboard')
const FinanceView = lazyWithRetry(() => import('./components/Finance/FinanceView.jsx'), 'finance')
const SettingsView = lazyWithRetry(() => import('./components/Settings/SettingsView.jsx'), 'settings')
const TaskModal = lazyWithRetry(() => import('./components/Tasks/TaskModal.jsx'), 'task-modal')
const TimeView = lazyWithRetry(() => import('./components/Team/TimeView.jsx'), 'team')
const TutorialsHub = lazyWithRetry(() => import('./components/onboarding/TutorialsHub.jsx'), 'tutorials-hub')
const CommandPalette = lazyWithRetry(() => import('./components/shared/CommandPalette.jsx'), 'command-palette')
const ReminderToast = lazyWithRetry(() => import('./components/shared/ReminderToast.jsx'), 'reminder-toast')
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard.jsx'), 'admin-dashboard')
const TenantsPage = lazyWithRetry(() => import('./components/admin/TenantsPage.jsx'), 'admin-tenants')
const AuditPage = lazyWithRetry(() => import('./components/admin/AuditPage.jsx'), 'admin-audit')
const PlansPage = lazyWithRetry(() => import('./components/admin/PlansPage.jsx'), 'admin-plans')

const PRIORITY_ORDER = { Alta: 3, Media: 2, Baixa: 1, 'Média': 2 }
const APP_TABS = new Set(['dashboard', 'tarefas', 'atividades', 'financas', 'time', 'clientes', 'arquivo', 'calendario', 'tutoriais', 'settings', 'admin-dashboard', 'admin-tenants', 'admin-audit', 'admin-plans'])
const CONTENT_SEARCH_TABS = new Set(['time', 'clientes', 'tutoriais'])
const COMMAND_PALETTE_SEARCH_TABS = new Set(['dashboard', 'tarefas', 'atividades', 'financas', 'arquivo', 'calendario', 'settings'])
const TAB_LOADING_LABELS = {
  dashboard: 'Carregando dashboard...',
  tarefas: 'Carregando tarefas...',
  atividades: 'Carregando atividades...',
  financas: 'Carregando finanças...',
  time: 'Carregando time...',
  clientes: 'Carregando clientes...',
  arquivo: 'Carregando arquivo...',
  calendario: 'Carregando calendário...',
  tutoriais: 'Carregando tutoriais...',
  settings: 'Carregando configurações...',
  'admin-dashboard': 'Carregando dashboard admin...',
  'admin-tenants': 'Carregando tenants...',
  'admin-audit': 'Carregando auditoria...',
  'admin-plans': 'Carregando planos...',
}

const TAB_ERROR_LABELS = {
  dashboard: 'o dashboard',
  tarefas: 'a área de tarefas',
  atividades: 'a área de atividades',
  financas: 'a área de finanças',
  time: 'a área de time',
  clientes: 'a área de clientes',
  arquivo: 'a área de arquivo',
  calendario: 'a área de calendário',
  tutoriais: 'a central de tutoriais',
  settings: 'a área de configurações',
  'admin-dashboard': 'o dashboard admin',
  'admin-tenants': 'a lista de tenants',
  'admin-audit': 'a auditoria',
  'admin-plans': 'a gestão de planos',
}

function readInitialAppTab() {
  if (typeof window === 'undefined') return 'tarefas'
  const url = new URL(window.location.href)
  const nextTab = url.searchParams.get('tab')?.trim() || ''
  return APP_TABS.has(nextTab) ? nextTab : 'tarefas'
}

function readInitialSettingsTab() {
  if (typeof window === 'undefined') return 'members'
  const url = new URL(window.location.href)
  return url.searchParams.get('settingsTab')?.trim() || 'members'
}

function App() {
  const [activeTab, setActiveTab] = useState(readInitialAppTab)
  const [viewType, setViewType] = useState('kanban')
  const [pendingSettingsTab, setPendingSettingsTab] = useState(null)
  const [tasks, setTasks] = useState([])
  const [team, setTeam] = useState([])
  const [clients, setClients] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState(null)
  const [bootstrapRetryKey, setBootstrapRetryKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(null)
  const [filterTag, setFilterTag] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [addModalStatus, setAddModalStatus] = useState('A Fazer')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [initialSettingsTab] = useState(readInitialSettingsTab)
  const [tutorialSearchQuery, setTutorialSearchQuery] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const [tourAutoPrompted, setTourAutoPrompted] = useState(false)

  const { user, signOut, isPlatformAdmin } = useAuth()
  const { activeTenantId } = useTenant()
  const { activities } = useActivities({ tenantId: activeTenantId })
  const onboarding = useOnboarding({ tenantId: activeTenantId, enabled: Boolean(activeTenantId) })
  const {
    isOpen: paletteOpen,
    query,
    setQuery,
    open: openPalette,
    close: closePalette,
    results,
  } = useCommandPalette(tasks, clients, activities)
  const { createReceivable, listReceivables } = useReceivables({ tenantId: activeTenantId })
  const previousTabRef = useRef(activeTab)

  const fetchTeam = async () => {
    try {
      const data = await fetchWorkspaceBootstrap(activeTenantId)
      setTeam(data.team || [])
    } catch (error) {
      console.error('Error fetching team:', error)
    }
  }

  const fetchClients = async () => {
    try {
      const data = await fetchWorkspaceBootstrap(activeTenantId)
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  useEffect(() => {
    // Explicit guard: don't fetch workspace data until a tenant is confirmed.
    // Without this, the app renders a false empty-state on first mount for users
    // with no workspace (noActiveWorkspace path). The localStorage fallback in
    // activeTenant.js covers the timing race, but this guard removes the
    // dependency on timing entirely.
    if (!activeTenantId) {
      setBootstrapError(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setBootstrapError(null)
    traceBootstrap('start', activeTenantId)

    fetchWorkspaceBootstrap(activeTenantId)
      .then((data) => {
        if (cancelled) return
        setTasks(data.tasks || [])
        setTeam(data.team || [])
        setClients(data.clients || [])
        setColumns(data.columns || [])
        setBootstrapError(null)
        traceBootstrap('ready', activeTenantId)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching workspace data:', error)
        setBootstrapError(error)
        traceBootstrap('error', activeTenantId, error.message)
        traceAsyncFailure('bootstrap-failure', error, { stage: 'app-bootstrap', tenantId: activeTenantId })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      traceBootstrap('cancelled', activeTenantId)
      cancelled = true
    }
  }, [activeTenantId, bootstrapRetryKey])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleViewportChange = (event) => {
      if (!event.matches) {
        setMobileSidebarOpen(false)
      }
    }

    handleViewportChange(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange)
      return () => mediaQuery.removeEventListener('change', handleViewportChange)
    }

    mediaQuery.addListener(handleViewportChange)
    return () => mediaQuery.removeListener(handleViewportChange)
  }, [])

  const allTags = useMemo(() => [...new Set((tasks || []).flatMap((task) => task.tags || []))], [tasks])

  const filteredTasks = useMemo(() => {
    let result = tasks || []

    if (searchQuery) {
      result = result.filter((task) => (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    }

    if (filterTag) {
      result = result.filter((task) => Array.isArray(task.tags) && task.tags.includes(filterTag))
    }

    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0))
    }

    if (sortBy === 'title') {
      result = [...result].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'))
    }

    if (sortBy === 'progress') {
      result = [...result].sort((a, b) => (b.progress || 0) - (a.progress || 0))
    }

    return result
  }, [tasks, searchQuery, filterTag, sortBy])

  const onboardingPanelDismissed = Boolean(onboarding.state.dismissState?.['dashboard.onboarding-panel']?.dismissed)
  const checklistPreview = onboarding.checklist.filter((item) => !item.completed)
  const shouldShowOnboardingPanel = Boolean(
    activeTenantId &&
    !onboarding.loading &&
    !onboardingPanelDismissed &&
    checklistPreview.length
  )

  const noActiveWorkspace = !activeTenantId && !loading

  // Stable ref so the effect callback always sees the latest onboarding methods
  // without listing the entire object (which changes every render) as a dep.
  const onboardingRef = useRef(onboarding)
  useEffect(() => { onboardingRef.current = onboarding })

  const onboardingLoading = onboarding.loading
  const tourStateStatus = onboarding.state.tourState?.status
  const tourStateLastStep = onboarding.state.tourState?.last_step

  useEffect(() => {
    if (!activeTenantId || onboardingLoading || tourAutoPrompted) return
    if (activeTab !== 'dashboard') return

    const status = tourStateStatus || 'not_started'
    const lastStep = Number(tourStateLastStep || 0)

    if (status === 'not_started') {
      setTourStepIndex(lastStep)
      setTourOpen(true)
      setTourAutoPrompted(true)
      const ob = onboardingRef.current
      void ob.updateTourState(
        {
          ...ob.state.tourState,
          status: 'in_progress',
          last_step: lastStep,
        },
        'tour_started'
      )
    }
  }, [activeTenantId, activeTab, onboardingLoading, tourStateStatus, tourStateLastStep, tourAutoPrompted])

  useEffect(() => {
    if (previousTabRef.current !== activeTab) {
      traceRouteTransition(previousTabRef.current, activeTab, 'complete')
      previousTabRef.current = activeTab
    }
  }, [activeTab])

  const handleTabChange = (tab) => {
    // Close the palette synchronously so it disappears immediately rather than
    // staying visible while the deferred tab transition is in-flight.
    closePalette()
    if (tab !== 'settings') {
      setPendingSettingsTab(null)
    }
    traceRouteTransition(activeTab, tab, 'start')
    startTransition(() => {
      setActiveTab(tab)
      setSearchQuery('')
      setTutorialSearchQuery('')
      setShowFilterMenu(false)
      setShowSortMenu(false)
    })
  }

  const handleOpenTour = () => {
    const lastStep = Number(onboarding.state.tourState?.last_step || 0)
    setTourStepIndex(lastStep)
    setTourOpen(true)

    if (onboarding.state.tourState?.status !== 'completed') {
      void onboarding.updateTourState(
        {
          ...onboarding.state.tourState,
          status: 'in_progress',
          last_step: lastStep,
        },
        onboarding.state.tourState?.status === 'not_started' ? 'tour_started' : null
      )
    }
  }

  const handleTourStepChange = (nextStepIndex) => {
    setTourStepIndex(nextStepIndex)
    void onboarding.updateTourState({
      ...onboarding.state.tourState,
      status: 'in_progress',
      last_step: nextStepIndex,
    })
  }

  const handleTourSkip = (stepIndex = tourStepIndex) => {
    setTourOpen(false)
    setTourStepIndex(stepIndex)
    void onboarding.updateTourState(
      {
        ...onboarding.state.tourState,
        status: 'skipped',
        last_step: stepIndex,
      },
      'tour_skipped'
    )
  }

  const handleTourComplete = async () => {
    setTourOpen(false)
    try {
      await onboarding.updateTourState(
        {
          ...onboarding.state.tourState,
          status: 'completed',
          last_step: tourStepIndex,
        },
        'tour_completed'
      )

      if (!onboarding.checklist.find((item) => item.id === 'review-workspace')?.completed) {
        await onboarding.completeChecklistItem('review-workspace', { source: 'tour' })
      }
    } catch (error) {
      console.error('Error completing tour:', error)
    }
  }

  const openTutorialHub = (tutorialId = null) => {
    if (tutorialId) {
      void onboarding.markTutorialOpened(tutorialId)
    }
    handleTabChange('tutoriais')
  }

  const trackOnboardingEvent = (eventName, eventPayload = {}) => {
    void onboarding.emitEvent(eventName, eventPayload)
  }

  const addTask = async (task) => {
    const payload = { ...task }
    delete payload.related_to

    try {
      const created = await createTaskRecord({ ...payload, created_at: new Date().toISOString() }, activeTenantId)
      setTasks((prev) => [created, ...prev])
      setShowAddModal(false)
      return created
    } catch (error) {
      console.error('Error adding task:', error)
      alert('Erro ao adicionar tarefa: ' + error.message)
      return null
    }
  }

  const updateTask = async (id, updates) => {
    const cleanUpdates = { ...updates }
    delete cleanUpdates.related_to

    const terminalColumnName = columns[columns.length - 1]?.name
    const task = tasks.find((item) => item.id === id)
    const movingToTerminal = terminalColumnName &&
      cleanUpdates.status === terminalColumnName &&
      task?.status !== terminalColumnName
    const leavingTerminal = terminalColumnName &&
      task?.status === terminalColumnName &&
      cleanUpdates.status &&
      cleanUpdates.status !== terminalColumnName

    if (movingToTerminal && !task?.completed_at) {
      cleanUpdates.completed_at = new Date().toISOString()
    } else if (leavingTerminal) {
      cleanUpdates.completed_at = null
    }

    let updatedTask
    try {
      updatedTask = await updateTaskRecord(id, cleanUpdates, activeTenantId)
    } catch (error) {
      console.error('Error updating task:', error)
      alert('Erro ao atualizar tarefa: ' + error.message)
      return null
    }

    setTasks((prev) => prev.map((item) => (item.id === id ? updatedTask : item)))

    if (movingToTerminal) {
      const existing = listReceivables({ taskId: Number(id) })
      if (shouldCreateReceivable(updatedTask, existing)) {
        const allAccounts = await listActiveAccounts(activeTenantId)
        const principal = findPrincipal(allAccounts || [])
        if (principal) {
          await createReceivable(id, updatedTask.deal_value, principal.id)
        } else {
          alert('Nenhuma conta principal definida. Acesse Finanças -> Contas para definir uma conta principal.')
        }
      }
    }

    return updatedTask
  }

  const deleteTask = async (id) => {
    try {
      await deleteTaskRecord(id, activeTenantId)
      setTasks((prev) => prev.filter((task) => task.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const archiveTask = async (id) => {
    try {
      await archiveTaskRecord(id, activeTenantId)
      setTasks((prev) => prev.filter((task) => task.id !== id))
    } catch (error) {
      console.error('Error archiving task:', error)
    }
  }

  const restoreTask = async (id) => {
    try {
      const restored = await restoreTaskRecord(id, activeTenantId)
      if (restored) {
        setTasks((prev) => [restored, ...prev.filter((task) => task.id !== id)])
      } else {
        console.error('restoreTask: no data returned for task', id)
      }
    } catch (error) {
      console.error('Error restoring task:', error)
    }
  }

  const addColumn = async (name) => {
    const orderIndex = columns.length > 0 ? Math.max(...columns.map((column) => column.order_index)) + 1 : 1
    try {
      const created = await createColumnRecord({ name, order_index: orderIndex }, activeTenantId)
      setColumns((prev) => [...prev, created])
    } catch (error) {
      console.error('Error adding column:', error)
      alert('Erro ao adicionar coluna Kanban: ' + error.message)
    }
  }

  const deleteColumn = async (id) => {
    try {
      await deleteColumnRecord(id, activeTenantId)
      setColumns((prev) => prev.filter((column) => column.id !== id))
    } catch (error) {
      console.error('Error deleting column:', error)
    }
  }

  const openAddModal = (status = 'A Fazer') => {
    setAddModalStatus(status)
    setShowAddModal(true)
  }

  const closeMenus = () => {
    setShowFilterMenu(false)
    setShowSortMenu(false)
  }

  const retryBootstrap = () => {
    traceBootstrap('retry', activeTenantId)
    setBootstrapRetryKey((current) => current + 1)
  }

  const handleShellMenuToggle = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      setMobileSidebarOpen((current) => !current)
      return
    }

    setSidebarCollapsed((current) => !current)
  }

  const handleProfileSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error)
      alert('Não foi possível sair do NexusCRM agora.')
    }
  }

  const pageSearchConfig = CONTENT_SEARCH_TABS.has(activeTab)
    ? {
        value: activeTab === 'tutoriais' ? tutorialSearchQuery : searchQuery,
        onSearch: activeTab === 'tutoriais' ? setTutorialSearchQuery : setSearchQuery,
        onSearchFocus: undefined,
        placeholder: activeTab === 'time'
          ? 'Buscar membro ou função'
          : activeTab === 'tutoriais'
            ? 'Buscar tutorial ou módulo'
            : 'Buscar cliente ou indústria',
      }
    : COMMAND_PALETTE_SEARCH_TABS.has(activeTab)
      ? {
          value: query,
          onSearch: (value) => {
            if (!paletteOpen) openPalette()
            setQuery(value)
          },
          onSearchFocus: openPalette,
          placeholder: 'Ir para cliente, tarefa ou atividade',
        }
      : {
          value: '',
          onSearch: () => {},
          onSearchFocus: undefined,
          placeholder: 'Pesquisar',
        }

  const renderContent = () => {
    if (bootstrapError) {
      return (
        <EmptyState
          title="NÃ£o foi possÃ­vel carregar o espaÃ§o de trabalho"
          description="A inicializaÃ§Ã£o do workspace falhou antes da Ã¡rea operacional ficar pronta."
          detail={bootstrapError.message || 'Tente novamente para refazer o bootstrap do tenant ativo.'}
          action={(
            <button
              type="button"
              className="page-action-bar__button page-action-bar__button--primary"
              onClick={retryBootstrap}
            >
              Tentar novamente
            </button>
          )}
        />
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            tasks={tasks}
            columns={columns}
            onboardingPanel={noActiveWorkspace ? null : shouldShowOnboardingPanel ? (
              <OnboardingPanel
                progress={onboarding.completedChecklistCount}
                total={onboarding.totalChecklistCount}
                items={checklistPreview}
                onOpenTutorials={() => handleTabChange('tutoriais')}
                onOpenTour={handleOpenTour}
                onSelectItem={(item) => {
                  if (item.tutorialId) {
                    void onboarding.markTutorialOpened(item.tutorialId)
                  }
                  handleTabChange(item.ctaTarget || 'dashboard')
                }}
                onDismiss={() => onboarding.dismissSurface({
                  scope: 'dashboard.onboarding-panel',
                  reason: 'manual_close',
                })}
              />
            ) : null}
            onCreateWorkspace={noActiveWorkspace ? () => {
              setPendingSettingsTab('workspace')
              handleTabChange('settings')
            } : undefined}
          />
        )
      case 'tarefas':
        return (
          <TasksPage
            viewType={viewType}
            setViewType={setViewType}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            filterTag={filterTag}
            setFilterTag={setFilterTag}
            allTags={allTags}
            showSortMenu={showSortMenu}
            setShowSortMenu={setShowSortMenu}
            showFilterMenu={showFilterMenu}
            setShowFilterMenu={setShowFilterMenu}
            onCreateTask={() => openAddModal()}
            taskCount={filteredTasks.length}
            emptyState={{
              title: 'O board começa com a primeira tarefa real da operação',
              description: 'Use tarefas para concentrar execução, prioridade e responsabilidade no mesmo fluxo.',
              detail: searchQuery || filterTag
                ? 'Nenhuma tarefa corresponde aos filtros atuais.'
                : 'Esta área ainda está vazia porque nenhuma tarefa real foi criada neste espaço de trabalho.',
              quickActions: [
                {
                  id: 'create-first-task',
                  label: 'Criar primeira tarefa',
                  onClick: () => {
                    trackOnboardingEvent('quick_action_triggered', {
                      surface: 'tasks.empty',
                      actionId: 'create-first-task',
                    })
                    openAddModal()
                  },
                },
              ],
              tutorialAction: {
                label: 'Abrir tutorial',
                onClick: () => {
                  trackOnboardingEvent('empty_state_cta_clicked', {
                    surface: 'tasks.empty',
                    actionId: 'tutorial',
                  })
                  openTutorialHub('getting-started.tasks')
                },
              },
            }}
            content={(
              <div className="board-container">
                {viewType === 'kanban' && (
                  <KanbanView
                    tasks={filteredTasks}
                    columns={columns}
                    onAddTask={openAddModal}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onEditTask={(task) => {
                      setSelectedTask(task)
                      setShowEditModal(true)
                    }}
                    onAddColumn={addColumn}
                    onDeleteColumn={deleteColumn}
                    onArchive={archiveTask}
                  />
                )}
                {viewType === 'list' && (
                  <ListView
                    tasks={filteredTasks}
                    columns={columns}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                  />
                )}
                {viewType === 'overview' && <OverviewView tasks={filteredTasks} />}
                {viewType === 'files' && (
                  <div className="tasks-files-view">
                    <EmptyState
                      title="Nenhum arquivo vinculado"
                      description="Centralize anexos e materiais de apoio da operação em uma camada organizada por tarefa."
                      detail={
                        searchQuery || filterTag
                          ? 'Nenhuma tarefa com os filtros atuais possui arquivos vinculados.'
                          : 'Esta área está vazia porque nenhum arquivo foi relacionado às tarefas ainda.'
                      }
                    />
                  </div>
                )}
                {viewType === 'calendar' && (
                  <Suspense fallback={<DeferredSurface label="Carregando calendário de tarefas..." />}>
                    <CalendarView
                      filterTypes={['task']}
                      tasks={filteredTasks}
                      clients={clients}
                      team={team}
                      columns={columns}
                      onUpdateTask={updateTask}
                      onAddTask={addTask}
                    />
                  </Suspense>
                )}
              </div>
            )}
          />
        )
      case 'time':
        return (
          <TimeView
            tasks={tasks}
            team={team}
            onRefresh={fetchTeam}
            searchQuery={searchQuery}
            onOpenTutorial={() => openTutorialHub('getting-started.workspace')}
            onTrackOnboarding={trackOnboardingEvent}
          />
        )
      case 'clientes':
        return (
          <ClientesView
            clients={clients}
            tasks={tasks}
            onRefresh={fetchClients}
            searchQuery={searchQuery}
            onOpenTutorial={() => openTutorialHub('getting-started.clients')}
            onTrackOnboarding={trackOnboardingEvent}
          />
        )
      case 'atividades':
        return (
          <ActivitiesView
            clients={clients}
            tasks={tasks}
            team={team}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            onOpenTutorial={() => openTutorialHub('getting-started.activities')}
            onTrackOnboarding={trackOnboardingEvent}
            showTimelineHint={!onboarding.state.dismissState?.['activities.hint.timeline']?.dismissed}
            onDismissTimelineHint={() => onboarding.dismissSurface({
              scope: 'activities.hint.timeline',
              reason: 'manual_close',
            })}
          />
        )
      case 'financas':
        return (
          <FinanceView
            clients={clients}
            tasks={tasks}
            team={team}
            onAddTask={addTask}
            columns={columns}
            onOpenTutorial={() => openTutorialHub('getting-started.finance')}
            onTrackOnboarding={trackOnboardingEvent}
            showFiltersHint={!onboarding.state.dismissState?.['finance.hint.filters']?.dismissed}
            onDismissFiltersHint={() => onboarding.dismissSurface({
              scope: 'finance.hint.filters',
              reason: 'manual_close',
            })}
          />
        )
      case 'arquivo':
        return (
          <ArchiveView
            restoreTask={restoreTask}
            showHint={!onboarding.state.dismissState?.['archive.hint']?.dismissed}
            onDismissHint={() => onboarding.dismissSurface({
              scope: 'archive.hint',
              reason: 'manual_close',
            })}
            onOpenTutorial={() => openTutorialHub('getting-started.workspace')}
            onTrackOnboarding={trackOnboardingEvent}
          />
        )
      case 'calendario':
        return (
          <CalendarWorkspacePage
            tasks={filteredTasks}
            clients={clients}
            team={team}
            columns={columns}
            onUpdateTask={updateTask}
            onAddTask={addTask}
            showHint={!onboarding.state.dismissState?.['calendar.hint']?.dismissed}
            onDismissHint={() => onboarding.dismissSurface({
              scope: 'calendar.hint',
              reason: 'manual_close',
            })}
            onOpenTutorial={() => openTutorialHub('getting-started.activities')}
            onTrackOnboarding={trackOnboardingEvent}
          />
        )
      case 'tutoriais':
        return (
          <TutorialsHub
            tutorials={onboarding.tutorials}
            categories={TUTORIAL_CATEGORIES}
            completedTutorialIds={onboarding.state.tutorialState?.completed || []}
            searchValue={tutorialSearchQuery}
            onSearch={setTutorialSearchQuery}
            onOpenTour={handleOpenTour}
            onOpenTutorial={(tutorial) => {
              void onboarding.markTutorialOpened(tutorial.id)
              handleTabChange(tutorial.targetTab || 'dashboard')
            }}
            onOpenQuickAction={(action, tutorial) => {
              if (tutorial?.id) {
                void onboarding.markTutorialOpened(tutorial.id)
              }
              handleTabChange(action.targetTab || tutorial?.targetTab || 'dashboard')
            }}
          />
        )
      case 'settings':
        return (
          <SettingsView
            initialTab={pendingSettingsTab || initialSettingsTab}
            showHint={!onboarding.state.dismissState?.['settings.hint']?.dismissed}
            onDismissHint={() => onboarding.dismissSurface({
              scope: 'settings.hint',
              reason: 'manual_close',
            })}
            onOpenTutorial={() => openTutorialHub('getting-started.workspace')}
            onTrackOnboarding={trackOnboardingEvent}
          />
        )
      case 'admin-dashboard': return <AdminDashboard />
      case 'admin-tenants': return <TenantsPage />
      case 'admin-audit': return <AuditPage />
      case 'admin-plans': return <PlansPage />
      default:
        return null
    }
  }

  if (loading) {
    return <div className="loading-screen">Carregando NexusCRM...</div>
  }

  return (
    <div onClick={closeMenus}>
      <AppShell
        sidebarCollapsed={sidebarCollapsed}
        sidebar={(
          <SidebarRail
            activeTab={activeTab}
            onChange={handleTabChange}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        )}
        topbar={(
          <Topbar
            searchQuery={pageSearchConfig.value}
            onSearch={pageSearchConfig.onSearch}
            onSearchFocus={pageSearchConfig.onSearchFocus}
            searchPlaceholder={pageSearchConfig.placeholder}
            showSearch
            onMenuToggle={handleShellMenuToggle}
            isPlatformAdmin={isPlatformAdmin}
            profileMenu={(
              <ProfileMenu
                user={user}
                onOpenTour={handleOpenTour}
                onOpenTutorials={() => handleTabChange('tutoriais')}
                onSignOut={handleProfileSignOut}
              />
            )}
          />
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={MOTION_TRANSITIONS.fade}
            className="view-wrapper"
          >
            <ViewErrorBoundary resetKey={activeTab} areaLabel={TAB_ERROR_LABELS[activeTab] || 'esta área'}>
              <Suspense fallback={<DeferredSurface label={TAB_LOADING_LABELS[activeTab] || 'Carregando área...'} />}>
                {renderContent()}
              </Suspense>
            </ViewErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </AppShell>

      <Suspense fallback={null}>
        <ReminderToast activities={activities} />
      </Suspense>

      {(paletteOpen || query) ? (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={paletteOpen}
            query={query}
            setQuery={setQuery}
            results={results}
            onClose={closePalette}
            onSelect={(item) => {
              if (item.type === 'client') handleTabChange('clientes')
              else if (item.type === 'task') handleTabChange('tarefas')
              else if (item.type === 'activity') handleTabChange('atividades')
              closePalette()
            }}
            onCreateActivity={() => {
              handleTabChange('atividades')
              closePalette()
            }}
          />
        </Suspense>
      ) : null}

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <Suspense fallback={null}>
            <TaskModal
              task={selectedTask}
              onSave={async (entry) => {
                if (selectedTask) {
                  const { id, ...updates } = entry
                  const updated = await updateTask(id, updates)
                  if (!updated) return
                  setShowEditModal(false)
                  setSelectedTask(null)
                  return
                }

                const created = await addTask(entry)
                if (!created) return
                setShowAddModal(false)
                setSelectedTask(null)
              }}
              onClose={() => {
                setShowAddModal(false)
                setShowEditModal(false)
                setSelectedTask(null)
              }}
              defaultStatus={addModalStatus}
              team={team}
              clients={clients}
              tasks={tasks}
              columns={columns}
              onArchive={archiveTask}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <OnboardingTour
        open={tourOpen}
        initialStepIndex={tourStepIndex}
        onClose={() => setTourOpen(false)}
        onSkip={handleTourSkip}
        onComplete={handleTourComplete}
        onNavigate={handleTabChange}
        onStepChange={handleTourStepChange}
      />
    </div>
  )
}

export default App
