import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import KanbanView from './components/Tasks/KanbanView'
import ListView from './components/Tasks/ListView'
import OverviewView from './components/Tasks/OverviewView'
import TaskModal from './components/Tasks/TaskModal'
import Dashboard from './components/Dashboard/Dashboard'
import TimeView from './components/Team/TimeView'
import ClientesView from './components/Clients/ClientesView'
import { LayoutGrid, List as ListIcon, Plus, Filter, ArrowUpDown, BarChart2, Folder } from 'lucide-react'
import { supabase } from './lib/supabaseClient'

const PRIORITY_ORDER = { 'Alta': 3, 'Média': 2, 'Baixa': 1 }

function App() {
  const [activeTab, setActiveTab] = useState('tarefas')
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

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  const fetchTeam = async () => {
    const { data, error } = await supabase.from('team').select('*')
    if (error) console.error('Error fetching team:', error)
    else setTeam(data || [])
  }

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name')
    if (error) console.error('Error fetching clients:', error)
    else setClients(data || [])
  }

  const fetchColumns = async () => {
    const { data, error } = await supabase.from('kanban_columns').select('*').order('order_index')
    if (error) console.error('Error fetching columns:', error)
    else setColumns(data || [])
  }

  useEffect(() => {
    fetchTasks()
    fetchTeam()
    fetchClients()
    fetchColumns()
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
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...task, created_at: new Date() }])
      .select()

    if (error) {
      console.error('Error adding task:', error)
      alert('Erro ao adicionar tarefa.')
    } else {
      setTasks(prev => [data[0], ...prev])
      setShowAddModal(false)
    }
  }

  const updateTask = async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating task:', error)
    } else {
      setTasks(prev => prev.map(t => t.id === id ? data[0] : t))
    }
  }

  const deleteTask = async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
    } else {
      setTasks(prev => prev.filter(t => t.id !== id))
    }
  }

  const addColumn = async (name) => {
    const order_index = columns.length > 0 ? Math.max(...columns.map(c => c.order_index)) + 1 : 1
    const { data, error } = await supabase
      .from('kanban_columns')
      .insert([{ name, order_index }])
      .select()
    
    if (error) console.error('Error adding column:', error)
    else setColumns(prev => [...prev, data[0]])
  }

  const deleteColumn = async (id) => {
    const { error } = await supabase
      .from('kanban_columns')
      .delete()
      .eq('id', id)
    
    if (error) console.error('Error deleting column:', error)
    else setColumns(prev => prev.filter(c => c.id !== id))
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
    a.download = 'pettoflow-tarefas.csv'
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
      default: return 'PettoFlow'
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard tasks={tasks} />
      case 'tarefas':
        return (
          <>
            <section className="view-controls">
              <div className="tabs">
                <button
                  className={`tab-btn ${viewType === 'overview' ? 'active' : ''}`}
                  onClick={() => setViewType('overview')}
                >
                  <BarChart2 size={16} />
                  Visão Geral
                </button>
                <button
                  className={`tab-btn ${viewType === 'kanban' ? 'active' : ''}`}
                  onClick={() => setViewType('kanban')}
                >
                  <LayoutGrid size={16} />
                  Kanban
                </button>
                <button
                  className={`tab-btn ${viewType === 'list' ? 'active' : ''}`}
                  onClick={() => setViewType('list')}
                >
                  <ListIcon size={16} />
                  Lista
                </button>
                <button
                  className={`tab-btn ${viewType === 'files' ? 'active' : ''}`}
                  onClick={() => setViewType('files')}
                >
                  <Folder size={16} />
                  Arquivos
                </button>
              </div>

              <div className="actions">
                <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn ${sortBy ? 'active-filter' : ''}`}
                    onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false) }}
                  >
                    <ArrowUpDown size={16} /> Ordenar{sortBy ? ' ✓' : ''}
                  </button>
                  {showSortMenu && (
                    <div className="dropdown-menu">
                      <button onClick={() => { setSortBy('priority'); setShowSortMenu(false) }} className={sortBy === 'priority' ? 'selected' : ''}>Por Prioridade</button>
                      <button onClick={() => { setSortBy('title'); setShowSortMenu(false) }} className={sortBy === 'title' ? 'selected' : ''}>Por Título (A-Z)</button>
                      <button onClick={() => { setSortBy('progress'); setShowSortMenu(false) }} className={sortBy === 'progress' ? 'selected' : ''}>Por Progresso</button>
                      {sortBy && <button onClick={() => { setSortBy(null); setShowSortMenu(false) }} className="clear-btn">Limpar ordenação</button>}
                    </div>
                  )}
                </div>

                <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn ${filterTag ? 'active-filter' : ''}`}
                    onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false) }}
                  >
                    <Filter size={16} /> Filtrar{filterTag ? ' ✓' : ''}
                  </button>
                  {showFilterMenu && (
                    <div className="dropdown-menu">
                      {allTags.map(tag => (
                        <button key={tag} onClick={() => { setFilterTag(filterTag === tag ? null : tag); setShowFilterMenu(false) }} className={filterTag === tag ? 'selected' : ''}>
                          {tag}
                        </button>
                      ))}
                      {filterTag && <button onClick={() => { setFilterTag(null); setShowFilterMenu(false) }} className="clear-btn">Limpar filtro</button>}
                    </div>
                  )}
                </div>

                <button className="add-member-btn" onClick={() => openAddModal()}>
                  <Plus size={16} />
                  <span>Nova Tarefa</span>
                </button>
              </div>
            </section>

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
                />
              )}
              {viewType === 'list' && (
                <ListView 
                  tasks={filteredTasks} 
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                />
              )}
              {viewType === 'overview' && <OverviewView tasks={tasks} />}
              {viewType === 'files' && (
                <div className="empty-state">
                  <h2>Arquivos</h2>
                  <p>Nenhum arquivo anexado ao projeto ainda.</p>
                </div>
              )}
            </div>
          </>
        )
      case 'time':
        return <TimeView tasks={tasks} team={team} onRefresh={fetchTeam} searchQuery={searchQuery} />
      case 'clientes':
        return <ClientesView clients={clients} tasks={tasks} onRefresh={fetchClients} searchQuery={searchQuery} />
      default:
        return null
    }
  }

  if (!supabase) {
    return (
      <div className="loading-screen" style={{ color: '#ef4444' }}>
        <h2>Configuração Necessária</h2>
        <p>As variáveis de ambiente do Supabase não foram encontradas.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '10px', color: '#64748b' }}>
          Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas no Vercel.
        </p>
      </div>
    )
  }

  if (loading) return <div className="loading-screen">Carregando PettoFlow...</div>

  return (
    <div className="app-container" onClick={closeMenus}>
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      <main className="content">
        <Header
          title={getPageTitle()}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onExport={exportCSV}
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

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <TaskModal
            task={selectedTask}
            onSave={(entry) => {
              if (selectedTask) {
                const { id, ...updates } = entry
                updateTask(id, updates)
                setShowEditModal(false)
              } else {
                addTask(entry)
                setShowAddModal(false)
              }
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
