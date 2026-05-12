import { useEffect, useState } from 'react'
import { Building2, DollarSign, Users } from 'lucide-react'
import PageHeader from '../shared/PageHeader.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'
import { fetchAdminMetrics } from '../../lib/adminClient.js'

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAdminMetrics()
      .then(data => {
        setMetrics(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="admin-dashboard">
        <p className="admin-dashboard__loading">Carregando dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <p className="admin-dashboard__error">Erro: {error}</p>
      </div>
    )
  }

  const {
    total_tenants = 0,
    active_tenants = 0,
    mrr_total = 0,
    plan_distribution = {},
    recent_tenants = [],
  } = metrics

  return (
    <div className="admin-dashboard">
      <PageHeader
        eyebrow="Administração"
        title="Dashboard"
        subtitle="Visão consolidada de tenants, receita e distribuição de planos na plataforma."
        metrics={[
          { label: 'Total de Tenants', value: String(total_tenants), icon: Building2 },
          { label: 'Tenants Ativos', value: String(active_tenants), icon: Users },
          { label: 'MRR', value: formatBRL(mrr_total), icon: DollarSign },
        ]}
      />

      <div className="admin-dashboard__grid">
        <SurfaceCard className="admin-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Assinaturas</span>
              <h2>Distribuição de Planos</h2>
            </div>
          </div>

          {Object.keys(plan_distribution).length === 0 ? (
            <p className="admin-panel__empty">Nenhum plano registrado</p>
          ) : (
            <div className="admin-plan-list">
              {Object.entries(plan_distribution).map(([plan, count]) => (
                <div key={plan} className="admin-plan-row">
                  <span className="admin-plan-row__name">{plan}</span>
                  <strong className="admin-plan-row__count">{count}</strong>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="admin-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Crescimento</span>
              <h2>Últimos Tenants</h2>
            </div>
          </div>

          {recent_tenants.length === 0 ? (
            <p className="admin-panel__empty">Nenhum tenant criado ainda</p>
          ) : (
            <div className="admin-tenant-list">
              {recent_tenants.slice(0, 5).map(tenant => (
                <div key={tenant.id} className="admin-tenant-row">
                  <span className="admin-tenant-row__name">{tenant.name}</span>
                  <span className="admin-tenant-row__date">{formatDate(tenant.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
