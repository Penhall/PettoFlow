import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import KanbanView from './components/Tasks/KanbanView'
import ListView from './components/Tasks/ListView'
import OverviewView from './components/Tasks/OverviewView'
import AddTaskModal from './components/Tasks/AddTaskModal'
import Dashboard from './components/Dashboard/Dashboard'
import TimeView from './components/Team/TimeView'
import ClientesView from './components/Clients/ClientesView'
import { LayoutGrid, List as ListIcon, Plus, Filter, ArrowUpDown, BarChart2, Folder } from 'lucide-react'

const PRIORITY_ORDER = { 'Alta': 3, 'Média': 2, 'Baixa': 1 }

const initialTasks = [
  { id: 1, title: 'Método de pagamento via e-commerce', status: 'A Fazer', priority: 'Alta', owner: 'James Walker', tags: ['#Pesquisa', '#UX'], progress: 60 },
  { id: 2, title: 'Componente de botão web', status: 'A Fazer', priority: 'Baixa', owner: 'Ana Silva', tags: ['#Urgent', '#System'], progress: 30 },
  { id: 3, title: 'Sistema de design', status: 'Em Progresso', priority: 'Média', owner: 'James Walker', tags: ['#Design', '#UX'], progress: 45 },
  { id: 4, title: 'Wireframe Home', status: 'Concluído', priority: 'Alta', owner: 'Ana Silva', tags: ['#UX'], progress: 100 },
]

function App() {
  const [activeTab, setActiveTab] = useState('tarefas')
  const [viewType, setViewType] = useState('kanban')
  const [tasks, setTasks] = useState(initialTasks)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(null)
  const [filterTag, setFilterTag] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalStatus, setAddModalStatus] = useState('A Fazer')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)

  const allTags = useMemo(() => [...new Set(tasks.flatMap(t => t.tags))], [tasks])

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (searchQuery) result = result.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    if (filterTag) result = result.filter(t => t.tags.includes(filterTag))
    if (sortBy === 'priority') result = [...result].sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority])
    if (sortBy === 'title') result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    if (sortBy === 'progress') result = [...result].sort((a, b) => b.progress - a.progress)
    return result
  }, [tasks, searchQuery, filterTag, sortBy])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchQuery('')
    setShowFilterMenu(false)
    setShowSortMenu(false)
  }

  const addTask = (task) => {
    setTasks(prev => [...prev, { ...task, id: Date.now() }])
    setShowAddModal(false)
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
              {viewType === 'kanban' && <KanbanView tasks={filteredTasks} onAddTask={openAddModal} />}
              {viewType === 'list' && <ListView tasks={filteredTasks} />}
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
        return <TimeView tasks={tasks} />
      case 'clientes':
        return <ClientesView />
      default:
        return null
    }
  }

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
        {showAddModal && (
          <AddTaskModal
            onAdd={addTask}
            onClose={() => setShowAddModal(false)}
            defaultStatus={addModalStatus}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
