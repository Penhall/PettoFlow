import { useEffect, useState } from 'react'
import { fetchAdminTenants } from '../../lib/adminClient.js'
import TenantDetailModal from './TenantDetailModal.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    fetchAdminTenants()
      .then(data => { setTenants(data.tenants ?? []); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  const filtered = tenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="admin-tenants">
        <p className="admin-dashboard__loading">Carregando tenants...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-tenants">
        <p className="admin-dashboard__error">Erro: {error}</p>
      </div>
    )
  }

  return (
    <div className="admin-tenants">
      <div className="admin-tenants__toolbar">
        <input
          className="admin-search"
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="admin-panel__empty">Nenhum tenant encontrado</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Plano</th>
                <th>Usuários</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr
                  key={t.id}
                  className="admin-table__row--clickable"
                  onClick={() => setSelectedId(t.id)}
                >
                  <td>{t.name ?? '—'}</td>
                  <td className="admin-table__slug">{t.slug ?? '—'}</td>
                  <td>{t.plan ?? '—'}</td>
                  <td>{t.user_count ?? 0}</td>
                  <td>{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <TenantDetailModal
          tenantId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
