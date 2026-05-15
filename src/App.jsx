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
import { useRuntimeOrchestration } from './hooks/useRuntimeOrchestration.js'
import { useTenant } from './hooks/useTenant.js'
import { shouldCreateReceivable, getPrincipalAccount as findPrincipal } from './lib/financeUtils'
import { lazyWithRetry } from './lib/lazyWithRetry.js'
import { fail, getMutationData, isMutationOk, normalizeError, ok, runMutation } from './lib/mutationResult.js'
import { traceAsync, traceAsyncFailure, traceBootstrap, traceRouteTransition, traceTransitionConflict } from './lib/diagnostics.js'
import { MOTION_TRANSITIONS } from './lib/motionTokens.js'
import { TUTORIAL_CATEGORIES } from './lib/tutorialCatalog.js'
import { ACTION_TEXT, EMPTY_STATE_TEXT, ERROR_TEXT, LOADING_TEXT, SHELL_TEXT } from './content/uxText.js'
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
const TAB_LOADING_LABELS = LOADING_TEXT.tabs
const TAB_ERROR_LABELS = SHELL_TEXT.tabErrorLabels

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
  const [shellError, setShellError] = useState('')

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
  const {
    cancelWorkspaceLoad,
    completeTransition,
    failWorkspaceLoad,
    interruptTransition,
    resolveWorkspaceLoad,
    startRetry,
    startTransition: startRuntimeTransition,
    startWorkspaceLoad,
  } = useRuntimeOrchestration()
  const previousTabRef = useRef(activeTab)
  const pendingRouteTransitionRef = useRef(null)
  const activeTenantIdRef = useRef(activeTenantId)
  const refreshRequestRef = useRef({ team: 0, clients: 0 })
  const previousTenantIdRef = useRef(activeTenantId)

  activeTenantIdRef.current = activeTenantId

  useEffect(() => {
    const previousTenantId = previousTenantIdRef.current
    previousTenantIdRef.current = activeTenantId

    if (!previousTenantId || previousTenantId === activeTenantId) {
      return
    }

    const pendingTransition = pendingRouteTransitionRef.current
    if (pendingTransition) {
      traceTransitionConflict('route', pendingTransition, {
        from: activeTab,
        to: activeTab,
        source: 'tenant-change-cleanup',
      })
      traceRouteTransition(pendingTransition.from, pendingTransition.to, 'interrupted')
      interruptTransition('route', pendingTransition)
      pendingRouteTransitionRef.current = null
    }

    closePalette()
    setPendingSettingsTab(null)
    setSearchQuery('')
    setTutorialSearchQuery('')
    setSelectedTask(null)
    setShowAddModal(false)
    setShowEditModal(false)
    setShowFilterMenu(false)
    setShowSortMenu(false)
    setMobileSidebarOpen(false)
    setTourOpen(false)
    setTourAutoPrompted(false)
  }, [activeTab, activeTenantId, closePalette, interruptTransition])

  const runScopedWorkspaceRefresh = async (scope, tenantId, commit) => {
    if (!tenantId) {
      commit([])
      return []
    }

    const requestId = (refreshRequestRef.current[scope] || 0) + 1
    refreshRequestRef.current[scope] = requestId
    traceAsync(`app.${scope}-refresh`, 'start', { tenantId, requestId })

    try {
      const data = await fetchWorkspaceBootstrap(tenantId)
      const stale =
        refreshRequestRef.current[scope] !== requestId ||
        activeTenantIdRef.current !== tenantId

      if (stale) {
        traceAsync(`app.${scope}-refresh`, 'cancel', {
          tenantId,
          requestId,
          activeTenantId: activeTenantIdRef.current,
          reason: 'stale-response',
        })
        return null
      }

      const nextItems = commit(data)
      traceAsync(`app.${scope}-refresh`, 'resolve', {
        tenantId,
        requestId,
        size: nextItems.length,
      })
      return nextItems
    } catch (error) {
      const stale =
        refreshRequestRef.current[scope] !== requestId ||
        activeTenantIdRef.current !== tenantId

      if (stale) {
        traceAsync(`app.${scope}-refresh`, 'cancel', {
          tenantId,
          requestId,
          activeTenantId: activeTenantIdRef.current,
          reason: 'stale-error',
          message: error?.message ?? String(error),
        })
        return null
      }

      console.error(`Error fetching ${scope}:`, error)
      traceAsyncFailure('bootstrap-failure', error, {
        stage: `app-${scope}-refresh`,
        tenantId,
        requestId,
      })
      return null
    }
  }

  const fetchTeam = async () => {
    return runScopedWorkspaceRefresh('team', activeTenantId, (data) => {
      const nextTeam = data.team || []
      setTeam(nextTeam)
      return nextTeam
    })
  }

  const fetchClients = async () => {
    return runScopedWorkspaceRefresh('clients', activeTenantId, (data) => {
      const nextClients = data.clients || []
      setClients(nextClients)
      return nextClients
    })
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
      completeTransition('tenant', {
        reason: 'no-active-tenant',
      })
      return undefined
    }

    let cancelled = false
    let settled = false
    const workspaceRequestId = startWorkspaceLoad(
      activeTenantId,
      bootstrapRetryKey > 0 ? 'retry-bootstrap' : 'tenant-bootstrap',
      null,
    )
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
        resolveWorkspaceLoad(workspaceRequestId, activeTenantId, {
          tasks: data.tasks?.length ?? 0,
          team: data.team?.length ?? 0,
          clients: data.clients?.length ?? 0,
        })
        settled = true
        completeTransition('tenant', {
          tenantId: activeTenantId,
          reason: 'workspace-ready',
        })
        traceBootstrap('ready', activeTenantId)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching workspace data:', error)
        setBootstrapError(error)
        failWorkspaceLoad(workspaceRequestId, activeTenantId, error, {
          stage: 'app-bootstrap',
        })
        settled = true
        interruptTransition('tenant', {
          tenantId: activeTenantId,
          reason: 'workspace-error',
        })
        traceBootstrap('error', activeTenantId, error.message)
        traceAsyncFailure('bootstrap-failure', error, { stage: 'app-bootstrap', tenantId: activeTenantId })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      if (!settled) {
        traceBootstrap('cancelled', activeTenantId)
        cancelWorkspaceLoad(workspaceRequestId, activeTenantId, {
          stage: 'app-bootstrap.cleanup',
        })
      }
      cancelled = true
    }
  }, [
    activeTenantId,
    bootstrapRetryKey,
    cancelWorkspaceLoad,
    completeTransition,
    failWorkspaceLoad,
    interruptTransition,
    resolveWorkspaceLoad,
    startWorkspaceLoad,
  ])

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
      const pendingTransition = pendingRouteTransitionRef.current
      if (pendingTransition && pendingTransition.to === activeTab) {
        traceRouteTransition(pendingTransition.from, pendingTransition.to, 'complete')
        completeTransition('route', pendingTransition)
        pendingRouteTransitionRef.current = null
      } else {
        traceRouteTransition(previousTabRef.current, activeTab, 'complete')
        completeTransition('route', {
          from: previousTabRef.current,
          to: activeTab,
          reason: 'state-sync',
        })
      }
      previousTabRef.current = activeTab
    }
  }, [activeTab, completeTransition])

  const handleTabChange = (tab) => {
    // Close the palette synchronously so it disappears immediately rather than
    // staying visible while the deferred tab transition is in-flight.
    closePalette()
    if (tab !== 'settings') {
      setPendingSettingsTab(null)
    }
    const pendingTransition = pendingRouteTransitionRef.current
    if (pendingTransition && pendingTransition.to !== activeTab) {
      traceTransitionConflict('route', pendingTransition, {
        from: activeTab,
        to: tab,
        source: 'tab-change',
      })
      traceRouteTransition(pendingTransition.from, pendingTransition.to, 'interrupted')
      interruptTransition('route', pendingTransition)
    }
    pendingRouteTransitionRef.current = { from: activeTab, to: tab }
    traceRouteTransition(activeTab, tab, 'start')
    startRuntimeTransition('route', {
      from: activeTab,
      to: tab,
      detail: { source: 'tab-change' },
    })
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
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'tasks.add', code: 'missing_tenant' })
    const payload = { ...task }
    delete payload.related_to

    return runMutation('tasks.add', async () => {
      const created = await createTaskRecord({ ...payload, created_at: new Date().toISOString() }, activeTenantId)
      setTasks((prev) => [created, ...prev])
      setShowAddModal(false)
      return created
    })
  }

  const updateTask = async (id, updates) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'tasks.update', code: 'missing_tenant' })
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
    const updateResult = await runMutation('tasks.update', async () => updateTaskRecord(id, cleanUpdates, activeTenantId))
    if (!isMutationOk(updateResult)) {
      return updateResult
    }
    updatedTask = getMutationData(updateResult)

    setTasks((prev) => prev.map((item) => (item.id === id ? updatedTask : item)))

    if (movingToTerminal) {
      const existing = listReceivables({ taskId: Number(id) })
      if (shouldCreateReceivable(updatedTask, existing)) {
        const allAccounts = await listActiveAccounts(activeTenantId)
        const principal = findPrincipal(allAccounts || [])
        if (principal) {
          const receivableResult = await createReceivable(id, updatedTask.deal_value, principal.id)
          if (!isMutationOk(receivableResult)) return receivableResult
        } else {
          return fail(new Error('missing principal account'), { operation: 'tasks.createReceivable', code: 'validation_failed' })
        }
      }
    }

    return ok(updatedTask)
  }

  const deleteTask = async (id) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'tasks.delete', code: 'missing_tenant' })
    return runMutation('tasks.delete', async () => {
      await deleteTaskRecord(id, activeTenantId)
      setTasks((prev) => prev.filter((task) => task.id !== id))
      return true
    })
  }

  const archiveTask = async (id) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'tasks.archive', code: 'missing_tenant' })
    return runMutation('tasks.archive', async () => {
      await archiveTaskRecord(id, activeTenantId)
      setTasks((prev) => prev.filter((task) => task.id !== id))
      return true
    })
  }

  const restoreTask = async (id) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'tasks.restore', code: 'missing_tenant' })
    return runMutation('tasks.restore', async () => {
      const restored = await restoreTaskRecord(id, activeTenantId)
      if (restored) {
        setTasks((prev) => [restored, ...prev.filter((task) => task.id !== id)])
        return restored
      } else {
        throw new Error('restore returned no data')
      }
    })
  }

  const addColumn = async (name) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'columns.add', code: 'missing_tenant' })
    const orderIndex = columns.length > 0 ? Math.max(...columns.map((column) => column.order_index)) + 1 : 1
    return runMutation('columns.add', async () => {
      const created = await createColumnRecord({ name, order_index: orderIndex }, activeTenantId)
      setColumns((prev) => [...prev, created])
      return created
    })
  }

  const deleteColumn = async (id) => {
    if (!activeTenantId) return fail(new Error('tenant required'), { operation: 'columns.delete', code: 'missing_tenant' })
    return runMutation('columns.delete', async () => {
      await deleteColumnRecord(id, activeTenantId)
      setColumns((prev) => prev.filter((column) => column.id !== id))
      return true
    })
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
    startRetry('workspace', {
      tenantId: activeTenantId,
      reason: 'app-retry-button',
    })
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
    setShellError('')
    try {
      await signOut()
    } catch (error) {
      traceAsyncFailure('auth-failure', error, { stage: 'profile-sign-out' })
      setShellError(ERROR_TEXT.authSignOut)
    }
  }

  const pageSearchConfig = CONTENT_SEARCH_TABS.has(activeTab)
    ? {
        value: activeTab === 'tutoriais' ? tutorialSearchQuery : searchQuery,
        onSearch: activeTab === 'tutoriais' ? setTutorialSearchQuery : setSearchQuery,
        onSearchFocus: undefined,
        placeholder: activeTab === 'time'
          ? SHELL_TEXT.search.member
          : activeTab === 'tutoriais'
            ? SHELL_TEXT.search.tutorial
            : SHELL_TEXT.search.client,
      }
    : COMMAND_PALETTE_SEARCH_TABS.has(activeTab)
      ? {
          value: query,
          onSearch: (value) => {
            if (!paletteOpen) openPalette()
            setQuery(value)
          },
          onSearchFocus: openPalette,
          placeholder: SHELL_TEXT.search.command,
        }
      : {
          value: '',
          onSearch: () => {},
          onSearchFocus: undefined,
          placeholder: SHELL_TEXT.search.default,
        }

  const renderContent = () => {
    if (bootstrapError) {
      const safeBootstrapError = normalizeError(bootstrapError, { operation: 'workspace.bootstrap' })
      return (
        <EmptyState
          title={EMPTY_STATE_TEXT.workspaceBootstrap.title}
          description={EMPTY_STATE_TEXT.workspaceBootstrap.description}
          detail={safeBootstrapError.message || EMPTY_STATE_TEXT.workspaceBootstrap.detail}
          action={(
            <button
              type="button"
              className="page-action-bar__button page-action-bar__button--primary"
              onClick={retryBootstrap}
            >
              {ACTION_TEXT.retry}
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
    return <div className="loading-screen">{LOADING_TEXT.app}</div>
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
              <Suspense fallback={<DeferredSurface label={TAB_LOADING_LABELS[activeTab] || LOADING_TEXT.area} />}>
                {renderContent()}
              </Suspense>
            </ViewErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </AppShell>

      <Suspense fallback={null}>
        <ReminderToast activities={activities} />
      </Suspense>

      {shellError ? (
        <div role="alert" className="shell-error-toast">
          {shellError}
        </div>
      ) : null}

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
                  const result = await updateTask(id, updates)
                  if (!isMutationOk(result)) return result
                  setShowEditModal(false)
                  setSelectedTask(null)
                  return result
                }

                const result = await addTask(entry)
                if (!isMutationOk(result)) return result
                setShowAddModal(false)
                setSelectedTask(null)
                return result
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
