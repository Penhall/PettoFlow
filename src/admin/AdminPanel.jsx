import { useEffect, useState } from 'react'
import { Shield, RefreshCw, ArrowLeft, Users, Building2, ReceiptText, ScrollText } from 'lucide-react'
import { fetchAdminOverview, fetchAdminProfile, listAdminUsers } from '../lib/adminApi.js'

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 16,
      padding: 18,
      display: 'grid',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)' }}>
        <Icon size={18} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <strong style={{ fontSize: 28 }}>{value}</strong>
    </div>
  )
}

function DataTable({ title, columns, rows, emptyMessage }) {
  return (
    <section style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 16,
      padding: 18,
      overflowX: 'auto',
    }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyMessage}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    textAlign: 'left',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-secondary)',
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      verticalAlign: 'top',
                    }}
                  >
                    {column.render ? column.render(row) : row[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminPanel() {
  const [profile, setProfile] = useState(null)
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')

    try {
      const [nextProfile, nextOverview, nextUsers] = await Promise.all([
        fetchAdminProfile(),
        fetchAdminOverview(),
        listAdminUsers(),
      ])

      setProfile(nextProfile.admin ?? null)
      setOverview(nextOverview)
      setUsers(nextUsers.items ?? [])
      setUserTotal(nextUsers.total ?? nextUsers.items?.length ?? 0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar painel administrativo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const counts = overview?.counts ?? {}
  const tenants = overview?.tenants ?? []
  const subscriptions = overview?.subscriptions ?? []
  const auditLogs = overview?.auditLogs ?? []
  const billingEvents = overview?.billingEvents ?? []

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 28, display: 'grid', gap: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 700 }}>
              <Shield size={18} />
              Painel administrativo NexusCRM
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 30 }}>Operacao global da plataforma</h1>
              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
                {profile ? `Sessao administrativa ativa para ${profile.email}.` : 'Carregando perfil administrativo.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => { window.location.hash = '' }}
              title="Voltar ao workspace"
              aria-label="Voltar ao workspace"
            >
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="export-btn" onClick={() => loadAll()}>
              <RefreshCw size={16} />
              <span>Atualizar painel</span>
            </button>
          </div>
        </header>

        {error && (
          <section style={{
            background: 'rgba(220, 38, 38, 0.12)',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            color: '#fecaca',
            borderRadius: 16,
            padding: 16,
          }}>
            {error}
          </section>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <MetricCard icon={Building2} label="Tenants" value={counts.tenants ?? '—'} />
          <MetricCard icon={Users} label="Usuarios" value={userTotal || '—'} />
          <MetricCard icon={ReceiptText} label="Subscriptions" value={counts.subscriptions ?? '—'} />
          <MetricCard icon={ScrollText} label="Audit logs" value={counts.auditLogs ?? '—'} />
        </section>

        {loading ? (
          <section style={{ padding: 32, border: '1px solid var(--border-color)', borderRadius: 16 }}>
            Carregando painel administrativo...
          </section>
        ) : (
          <>
            <DataTable
              title="Tenants e uso"
              emptyMessage="Nenhum tenant encontrado."
              columns={[
                { key: 'name', label: 'Tenant' },
                { key: 'slug', label: 'Slug' },
                { key: 'usage', label: 'Uso', render: (row) => {
                  const usage = row.usage ?? {}
                  return `${usage.active_members ?? 0} usuarios · ${usage.clients ?? 0} clientes · ${usage.tasks ?? 0} tarefas`
                } },
                { key: 'created_at', label: 'Criado em', render: (row) => formatDate(row.created_at) },
              ]}
              rows={tenants}
            />

            <DataTable
              title="Usuarios autenticados"
              emptyMessage="Nenhum usuario encontrado."
              columns={[
                { key: 'email', label: 'Email' },
                { key: 'createdAt', label: 'Criado em', render: (row) => formatDate(row.createdAt) },
                { key: 'lastSignInAt', label: 'Ultimo login', render: (row) => formatDate(row.lastSignInAt) },
              ]}
              rows={users}
            />

            <DataTable
              title="Subscriptions"
              emptyMessage="Nenhuma subscription encontrada."
              columns={[
                { key: 'tenant_id', label: 'Tenant' },
                { key: 'status', label: 'Status' },
                { key: 'provider', label: 'Provider' },
                { key: 'plan', label: 'Plano', render: (row) => row.plan?.name ?? '—' },
                { key: 'current_period_end', label: 'Fim do periodo', render: (row) => formatDate(row.current_period_end) },
              ]}
              rows={subscriptions}
            />

            <DataTable
              title="Timeline de auditoria"
              emptyMessage="Nenhum evento de auditoria recente."
              columns={[
                { key: 'created_at', label: 'Quando', render: (row) => formatDate(row.created_at) },
                { key: 'tenant_id', label: 'Tenant' },
                { key: 'action', label: 'Acao' },
                { key: 'resource_type', label: 'Recurso' },
              ]}
              rows={auditLogs}
            />

            <DataTable
              title="Eventos operacionais de billing"
              emptyMessage="Nenhum evento de billing recente."
              columns={[
                { key: 'created_at', label: 'Quando', render: (row) => formatDate(row.created_at) },
                { key: 'event_type', label: 'Evento' },
                { key: 'status', label: 'Status' },
                { key: 'tenant_id', label: 'Tenant' },
                { key: 'error_message', label: 'Falha', render: (row) => row.error_message || '—' },
              ]}
              rows={billingEvents}
            />
          </>
        )}
      </div>
    </main>
  )
}
