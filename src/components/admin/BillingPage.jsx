import { useEffect, useState } from 'react'
import PageHeader from '../shared/PageHeader.jsx'
import { DollarSign, TrendingDown, Users, BarChart3 } from 'lucide-react'
import { fetchAdminBilling } from '../../lib/adminClient.js'
import { normalizeError } from '../../lib/mutationResult.js'

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

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function StatusBadge({ status, prefix = 'status' }) {
  return (
    <span className={`admin-billing__${prefix}-${status}`}>
      {status}
    </span>
  )
}

export default function BillingPage() {
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAdminBilling()
      .then(data => {
        setBilling(data)
        setLoading(false)
      })
      .catch(err => {
        setError(normalizeError(err, { operation: 'admin.billing' }).message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="admin-billing">
        <p className="admin-dashboard__loading">Carregando faturamento...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-billing">
        <p className="admin-dashboard__error">{error}</p>
      </div>
    )
  }

  const {
    summary = {},
    by_plan = [],
    recent_events = [],
    subscriptions_overview = [],
  } = billing ?? {}

  const {
    mrr_total = 0,
    churned_mrr = 0,
    active_subscriptions = 0,
    avg_revenue_per_tenant = 0,
  } = summary

  return (
    <div className="admin-billing">
      <PageHeader
        eyebrow="Administração"
        title="Faturamento"
        subtitle="Visão consolidada de receita, planos e assinaturas da plataforma."
        metrics={[
          { label: 'MRR Total', value: formatBRL(mrr_total), icon: DollarSign },
          { label: 'MRR Perdido', value: formatBRL(churned_mrr), icon: TrendingDown },
          { label: 'Assinaturas Ativas', value: String(active_subscriptions), icon: Users },
          { label: 'Receita média por espaço', value: formatBRL(avg_revenue_per_tenant), icon: BarChart3 },
        ]}
      />

      <div className="admin-panel">
        <p className="admin-panel__title">Por Plano</p>
        {by_plan.length === 0 ? (
          <p className="admin-panel__empty">Nenhum plano registrado</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Assinaturas Ativas</th>
                  <th>MRR</th>
                  <th>Total de clientes</th>
                </tr>
              </thead>
              <tbody>
                {by_plan.map(plan => (
                  <tr key={plan.plan_name}>
                    <td>{plan.plan_name}</td>
                    <td>{plan.active}</td>
                    <td>{formatBRL(plan.mrr)}</td>
                    <td>{plan.tenants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <p className="admin-panel__title">Eventos de Billing Recentes</p>
        {recent_events.length === 0 ? (
          <p className="admin-panel__empty">Nenhum evento de billing encontrado</p>
        ) : (
          <div className="admin-audit-timeline">
            {recent_events.map(event => (
              <div key={event.id} className="admin-audit-event">
                <div className="admin-audit-event__dot" />
                <div className="admin-audit-event__body">
                  <div className="admin-audit-event__header">
                    <span className="admin-audit-event__name">{event.event_type ?? '—'}</span>
                    <span className="admin-audit-event__tenant">{event.tenant_name ?? '—'}</span>
                    <StatusBadge status={event.status ?? 'received'} />
                    <span className="admin-audit-event__date">{formatDateTime(event.created_at)}</span>
                  </div>
                  {event.error_message && (
                    <div className="admin-audit-event__payload">{event.error_message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <p className="admin-panel__title">Assinaturas</p>
        {subscriptions_overview.length === 0 ? (
          <p className="admin-panel__empty">Nenhuma assinatura encontrada</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Espaço</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Vencimento</th>
                  <th>Dias Restantes</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions_overview.map(sub => (
                  <tr key={sub.tenant_id}>
                    <td>{sub.tenant_name ?? sub.tenant_id}</td>
                    <td>{sub.plan_name}</td>
                    <td>
                      <StatusBadge status={sub.status ?? 'inactive'} />
                    </td>
                    <td>{formatDate(sub.current_period_end)}</td>
                    <td>
                      {sub.days_until_renewal !== null
                        ? `${sub.days_until_renewal}d`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
