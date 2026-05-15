import { useCallback, useEffect, useState } from 'react'
import { fetchAdminAudit, fetchAdminTenants } from '../../lib/adminClient.js'
import { normalizeError } from '../../lib/mutationResult.js'

const PAGE_SIZE = 50

const EVENT_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'tenant.created', label: 'Espaço criado' },
  { value: 'tenant.updated', label: 'Espaço atualizado' },
  { value: 'user.invited', label: 'Usuário convidado' },
  { value: 'user.removed', label: 'Usuário removido' },
  { value: 'subscription.changed', label: 'Assinatura alterada' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
]

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function truncatePayload(metadata) {
  if (!metadata) return '—'
  const str = typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
  return str.length > 100 ? str.slice(0, 100) + '…' : str
}

export default function AuditPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [tenants, setTenants] = useState([])
  const [filters, setFilters] = useState({ tenantId: '', eventName: '', dateFrom: '', dateTo: '' })

  useEffect(() => {
    fetchAdminTenants()
      .then(data => setTenants(data.tenants ?? []))
      .catch(() => {})
  }, [])

  const loadAudit = useCallback((resetPage = false) => {
    const currentPage = resetPage ? 0 : page
    if (resetPage) {
      setLoading(true)
      setLogs([])
      setPage(0)
      setError(null)
    } else {
      setLoadingMore(true)
    }
    fetchAdminAudit({ ...filters, page: currentPage, pageSize: PAGE_SIZE })
      .then(data => {
        setLogs(prev => resetPage ? (data.logs ?? []) : [...prev, ...(data.logs ?? [])])
        setTotal(data.total ?? 0)
        setLoading(false)
        setLoadingMore(false)
      })
      .catch(err => {
        setError(normalizeError(err, { operation: 'admin.audit' }).message)
        setLoading(false)
        setLoadingMore(false)
      })
  }, [filters, page])

  useEffect(() => { loadAudit(true) }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    fetchAdminAudit({ ...filters, page: nextPage, pageSize: PAGE_SIZE })
      .then(data => {
        setLogs(prev => [...prev, ...(data.logs ?? [])])
        setTotal(data.total ?? 0)
        setLoadingMore(false)
      })
      .catch(() => setLoadingMore(false))
  }

  const showLoadMore = !loading && !loadingMore && logs.length > 0 && logs.length < total

  return (
    <div className="admin-audit">
      <div className="admin-audit__filters">
        <div className="admin-audit__filter-group">
          <label className="admin-audit__filter-label" htmlFor="audit-event">
            Tipo de evento
          </label>
          <select
            id="audit-event"
            className="admin-audit__select"
            value={filters.eventName}
            onChange={e => handleFilterChange('eventName', e.target.value)}
          >
            {EVENT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-audit__filter-group">
          <label className="admin-audit__filter-label" htmlFor="audit-tenant">
            Espaço
          </label>
          <select
            id="audit-tenant"
            className="admin-audit__select"
            value={filters.tenantId}
            onChange={e => handleFilterChange('tenantId', e.target.value)}
          >
            <option value="">Todos os espaços</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="admin-audit__filter-group">
          <label className="admin-audit__filter-label" htmlFor="audit-date-from">
            Data início
          </label>
          <input
            id="audit-date-from"
            className="admin-audit__date"
            type="date"
            value={filters.dateFrom}
            onChange={e => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>

        <div className="admin-audit__filter-group">
          <label className="admin-audit__filter-label" htmlFor="audit-date-to">
            Data fim
          </label>
          <input
            id="audit-date-to"
            className="admin-audit__date"
            type="date"
            value={filters.dateTo}
            onChange={e => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="admin-dashboard__loading">Carregando auditoria...</p>
      ) : error ? (
        <p className="admin-dashboard__error">{error}</p>
      ) : logs.length === 0 ? (
        <p className="admin-panel__empty">Nenhum evento de auditoria encontrado</p>
      ) : (
        <>
          <div className="admin-audit__summary">
            {total} evento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </div>

          <div className="admin-audit-timeline">
            {logs.map(log => (
              <div key={log.id} className="admin-audit-event">
                <div className="admin-audit-event__dot" />
                <div className="admin-audit-event__body">
                  <div className="admin-audit-event__header">
                    <span className="admin-audit-event__name">
                      {log.event_name ?? log.action ?? '—'}
                    </span>
                    <span className="admin-audit-event__tenant">
                      {log.tenant_name ?? '—'}
                    </span>
                    <span className="admin-audit-event__date">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  {(log.metadata ?? log.payload) && (
                    <div className="admin-audit-event__payload">
                      {truncatePayload(log.metadata ?? log.payload)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showLoadMore && (
            <div className="admin-audit__load-more">
              <button
                className="admin-audit__load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}

          {loadingMore && (
            <p className="admin-dashboard__loading">Carregando mais eventos...</p>
          )}
        </>
      )}
    </div>
  )
}
