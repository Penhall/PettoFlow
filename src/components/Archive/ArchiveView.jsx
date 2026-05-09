import { useState, useEffect, useCallback } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import { listArchivedTaskRecords } from '../../lib/workspaceCore'
import ContextualHint from '../onboarding/ContextualHint.jsx'

const PAGE_SIZE = 50

export default function ArchiveView({
  restoreTask,
  showHint = false,
  onDismissHint = () => {},
  onOpenTutorial = () => {},
  onTrackOnboarding = () => {},
}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ category: '', tag: '', dateFrom: '', dateTo: '' })

  const fetchArchived = useCallback(async (pageIndex = 0, currentFilters = filters) => {
    setLoading(true)
    try {
      const data = await listArchivedTaskRecords({
        page: pageIndex,
        pageSize: PAGE_SIZE,
        ...currentFilters,
      })
      setTasks(data?.items || [])
      setTotalCount(data?.totalCount || 0)
    } catch (error) {
      console.error('Error fetching archived tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchArchived(0, filters) }, [fetchArchived, filters])

  const applyFilters = () => {
    setPage(0)
    fetchArchived(0, filters)
  }

  const clearFilters = () => {
    const cleared = { category: '', tag: '', dateFrom: '', dateTo: '' }
    setFilters(cleared)
    setPage(0)
    fetchArchived(0, cleared)
  }

  const handleRestore = async (taskId) => {
    await restoreTask(taskId)
    fetchArchived(page, filters)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="archive-view" style={{ padding: '0 24px 24px' }}>
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingTop: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Archive size={18} /> Arquivo
        </h3>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {totalCount} tarefa{totalCount !== 1 ? 's' : ''} arquivada{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="finance-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">Todas categorias</option>
          <option value="Operacional">Operacional</option>
          <option value="Vendas">Vendas</option>
          <option value="Pessoal">Pessoal</option>
        </select>
        <input
          type="text"
          placeholder="Tag (ex: #design)"
          value={filters.tag}
          onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}
          style={{ width: 140 }}
          className="form-input"
        />
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
          className="form-input"
          style={{ width: 140 }}
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
          className="form-input"
          style={{ width: 140 }}
        />
        <button className="add-member-btn" onClick={applyFilters}>Filtrar</button>
        {(filters.category || filters.tag || filters.dateFrom || filters.dateTo) && (
          <button className="action-btn sm" onClick={clearFilters}>Limpar</button>
        )}
      </div>

      {showHint ? (
        <ContextualHint
          title="Use o arquivo como memória operacional, não como descarte"
          description="Filtre por categoria, data ou tag para recuperar contexto antes de restaurar uma tarefa."
          actionLabel="Abrir tutorial"
          onAction={() => {
            onTrackOnboarding('empty_state_cta_clicked', {
              surface: 'archive.hint',
              actionId: 'tutorial',
            })
            onOpenTutorial()
          }}
          onDismiss={onDismissHint}
        />
      ) : null}

      {loading ? (
        <div className="empty-state" style={{ padding: 32 }}>Carregando...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <Archive size={28} />
          <p>Nenhuma tarefa arquivada.</p>
        </div>
      ) : (
        <div className="archive-list">
          {tasks.map(task => (
            <div key={task.id} className="archive-row" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {task.category}
                  {task.archived_at && ` • Arquivado em ${new Date(task.archived_at).toLocaleDateString('pt-BR')}`}
                  {task.tags?.length > 0 && ` • ${task.tags.join(' ')}`}
                </div>
              </div>
              <button
                className="action-btn sm"
                onClick={() => handleRestore(task.id)}
                title="Restaurar tarefa"
                style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <RotateCcw size={13} /> Restaurar
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button
            className="action-btn"
            disabled={page === 0}
            onClick={() => {
              const newPage = page - 1
              setPage(newPage)
              fetchArchived(newPage, filters)
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13 }}>
            Pagina {page + 1} de {totalPages}
          </span>
          <button
            className="action-btn"
            disabled={page >= totalPages - 1}
            onClick={() => {
              const newPage = page + 1
              setPage(newPage)
              fetchArchived(newPage, filters)
            }}
          >
            Proxima →
          </button>
        </div>
      )}
    </div>
  )
}
