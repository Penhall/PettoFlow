import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import TasksPage from './components/Tasks/TasksPage'
import KanbanView from './components/Tasks/KanbanView'
import ListView from './components/Tasks/ListView'
import OverviewView from './components/Tasks/OverviewView'
import TaskModal from './components/Tasks/TaskModal'
import Dashboard from './components/Dashboard/Dashboard'
import TimeView from './components/Team/TimeView'
import ClientesView from './components/Clients/ClientesView'
import ActivitiesView from './components/Activities/ActivitiesView'
import FinanceView from './components/Finance/FinanceView'
import ArchiveView from './components/Archive/ArchiveView'
import CalendarView from './components/Calendar/CalendarView'
import SettingsView from './components/Settings/SettingsView'
import EmptyState from './components/shared/EmptyState'
import ReminderToast from './components/shared/ReminderToast'
import CommandPalette from './components/shared/CommandPalette'
import { useActivities } from './hooks/useActivities'
import { useCommandPalette } from './hooks/useCommandPalette'
import { useReceivables } from './hooks/useReceivables'
import { shouldCreateReceivable, getPrincipalAccount as findPrincipal } from './lib/financeUtils'
import {
  fetchWorkspaceBootstrap,
  createTaskRecord,
  updateTaskRecord,
  deleteTaskRecord,
  archiveTaskRecord,
  restoreTaskRecord,
  createColumnRecord,
  deleteColumnRecord,
  listActiveAccounts,
} from './lib/workspaceCore'

const PRIORITY_ORDER = { 'Alta': 3, 'Média': 2, 'Baixa': 1 }

const APP_TABS = new Set(['dashboard', 'tarefas', 'atividades', 'financas', 'time', 'clientes', 'arquivo', 'calendario', 'settings'])

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
  const [tasks, setTasks] = useState([])
  const [team, setTeam] = useState([])
  const [clients, setClients] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(null)
  const [filterTag, setFilterTag] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [addModalStatus, setAddModalStatus] = useState('A Fazer')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [initialSettingsTab] = useState(readInitialSettingsTab)

  const { activities } = useActivities()
  const { isOpen: paletteOpen, query, setQuery, results, close: closePalette } = useCommandPalette(tasks, clients, activities)
  const { createReceivable, listReceivables } = useReceivables()

  const fetchWorkspaceData = async () => {
    setLoading(true)
    try {
      const data = await fetchWorkspaceBootstrap()
      setTasks(data.tasks || [])
      setTeam(data.team || [])
      setClients(data.clients || [])
      setColumns(data.columns || [])
    } catch (error) {
      console.error('Error fetching workspace data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeam = async () => {
    try {
      const data = await fetchWorkspaceBootstrap()
      setTeam(data.team || [])
    } catch (error) {
      console.error('Error fetching team:', error)
    }
  }

  const fetchClients = async () => {
    try {
      const data = await fetchWorkspaceBootstrap()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  useEffect(() => {
    fetchWorkspaceData()
  }, [])

  const allTags = useMemo(() => [...new Set((tasks || []).flatMap(t => t.tags || []))], [tasks])

  const filteredTasks = useMemo(() => {
    let result = tasks || []
    if (searchQuery) {
      result = result.filter(t => (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (filterTag) {
      result = result.filter(t => t.tags && Array.isArray(t.tags) && t.tags.includes(filterTag))
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

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchQuery('')
    setShowFilterMenu(false)
    setShowSortMenu(false)
  }

  const addTask = async (task) => {
    const payload = { ...task }
    delete payload.related_to // tasks.related_to does not exist in the current schema
    try {
      const created = await createTaskRecord({ ...payload, created_at: new Date().toISOString() })
      setTasks(prev => [created, ...prev])
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

    // Detect if task is moving to the terminal column for the first time
    const terminalColumnName = columns[columns.length - 1]?.name
    const task = tasks.find(t => t.id === id)
    const movingToTerminal = (
      terminalColumnName &&
      cleanUpdates.status === terminalColumnName &&
      task?.status !== terminalColumnName
    )
    const leavingTerminal = (
      terminalColumnName &&
      task?.status === terminalColumnName &&
      cleanUpdates.status &&
      cleanUpdates.status !== terminalColumnName
    )

    // Set completed_at the first time a task enters the terminal column
    if (movingToTerminal && !task?.completed_at) {
      cleanUpdates.completed_at = new Date().toISOString()
    } else if (leavingTerminal) {
      cleanUpdates.completed_at = null
    }

    let updatedTask
    try {
      updatedTask = await updateTaskRecord(id, cleanUpdates)
    } catch (error) {
      console.error('Error updating task:', error)
      alert('Erro ao atualizar tarefa: ' + error.message)
      return
    }

    setTasks(prev => prev.map(t => t.id === id ? updatedTask : t))

    // Auto-create receivable when a Vendas task reaches the terminal column
    if (movingToTerminal) {
      const existing = listReceivables({ taskId: Number(id) })
      if (shouldCreateReceivable(updatedTask, existing)) {
        // Fetch accounts directly — useAccounts lives in FinanceView scope, not here
        const allAccounts = await listActiveAccounts()
        const principal = findPrincipal(allAccounts || [])
        if (principal) {
          await createReceivable(id, updatedTask.deal_value, principal.id)
        } else {
          alert('Nenhuma conta Principal definida. Acesse Finanças → Contas para definir uma conta como Principal.')
        }
      }
    }

    return updatedTask
  }

  const deleteTask = async (id) => {
    try {
      await deleteTaskRecord(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const archiveTask = async (id) => {
    try {
      await archiveTaskRecord(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error archiving task:', error)
    }
  }

  const restoreTask = async (id) => {
    try {
      const restored = await restoreTaskRecord(id)
      if (restored) {
        setTasks(prev => [restored, ...prev.filter(t => t.id !== id)])
      } else {
        console.error('restoreTask: no data returned for task', id)
      }
    } catch (error) {
      console.error('Error restoring task:', error)
    }
  }

  const addColumn = async (name) => {
    const order_index = columns.length > 0 ? Math.max(...columns.map(c => c.order_index)) + 1 : 1
    try {
      const created = await createColumnRecord({ name, order_index })
      setColumns(prev => [...prev, created])
    } catch (error) {
      console.error('Error adding column:', error)
      alert('Erro ao adicionar coluna Kanban: ' + error.message)
    }
  }

  const deleteColumn = async (id) => {
    try {
      await deleteColumnRecord(id)
      setColumns(prev => prev.filter(c => c.id !== id))
    } catch (error) {
      console.error('Error deleting column:', error)
    }
  }

  const openAddModal = (status = 'A Fazer') => {
    setAddModalStatus(status)
    setShowAddModal(true)
  }

  const exportCSV = () => {
    const header = 'Tarefa,Status,Prioridade,Responsável,Progresso'
    const rows = tasks.map(t => `"${t.title}","${t.status}","${t.priority}","${t.owner}","${t.progress}%"`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nexuscrm-tarefas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const closeMenus = () => {
    setShowFilterMenu(false)
    setShowSortMenu(false)
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard'
      case 'tarefas': return 'Minhas Tarefas'
      case 'time': return 'Time'
      case 'clientes': return 'Clientes'
      case 'atividades': return 'Atividades'
      case 'financas': return 'Finanças'
      case 'arquivo': return 'Arquivo'
      case 'calendario': return 'Calendário'
      case 'settings': return 'Configurações'
      default: return 'NexusCRM'
    }
  }

  const headerSearchHandler = activeTab === 'tarefas' ? null : setSearchQuery
  const headerExportHandler = activeTab === 'tarefas' ? null : exportCSV
  const headerTitle = activeTab === 'tarefas' ? null : getPageTitle()

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard tasks={tasks} columns={columns} />
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
            content={(
              <div className="board-container">
                {viewType === 'kanban' && (
                  <KanbanView
                    tasks={filteredTasks}
                    columns={columns}
                    onAddTask={openAddModal}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onEditTask={(task) => { setSelectedTask(task); setShowEditModal(true) }}
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
                      detail={searchQuery || filterTag
                        ? 'Nenhuma tarefa com os filtros atuais possui arquivos vinculados.'
                        : 'Esta área está vazia porque nenhum arquivo foi relacionado às tarefas ainda.'}
                    />
                  </div>
                )}
                {viewType === 'calendar' && (
                  <CalendarView
                    filterTypes={['task']}
                    tasks={filteredTasks}
                    clients={clients}
                    team={team}
                    columns={columns}
                    onUpdateTask={updateTask}
                    onAddTask={addTask}
                  />
                )}
              </div>
            )}
          />
        )
      case 'time':
        return <TimeView tasks={tasks} team={team} onRefresh={fetchTeam} searchQuery={searchQuery} />
      case 'clientes':
        return <ClientesView clients={clients} tasks={tasks} onRefresh={fetchClients} searchQuery={searchQuery} />
      case 'atividades':
        return <ActivitiesView clients={clients} tasks={tasks} team={team} searchQuery={searchQuery} />
      case 'financas':
        return <FinanceView clients={clients} tasks={tasks} team={team} onAddTask={addTask} columns={columns} />
      case 'arquivo':
        return <ArchiveView restoreTask={restoreTask} />
      case 'calendario':
        return (
          <CalendarView
            tasks={filteredTasks}
            clients={clients}
            team={team}
            columns={columns}
            onUpdateTask={updateTask}
            onAddTask={addTask}
          />
        )
      case 'settings':
        return <SettingsView initialTab={initialSettingsTab} />
      default:
        return null
    }
  }

  if (loading) return <div className="loading-screen">Carregando NexusCRM...</div>

  return (
    <div className="app-container" onClick={closeMenus}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="content">
        <Header
          title={headerTitle}
          searchQuery={searchQuery}
          onSearch={headerSearchHandler}
          onExport={headerExportHandler}
          onMenuToggle={() => setMobileSidebarOpen(prev => !prev)}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="view-wrapper"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <ReminderToast activities={activities} />

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
        onCreateActivity={() => { handleTabChange('atividades'); closePalette() }}
      />

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
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
        )}
      </AnimatePresence>
    </div>
  )
}

export default App

