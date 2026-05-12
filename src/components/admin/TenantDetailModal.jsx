import { useCallback, useEffect, useState } from 'react'
import { fetchAdminTenantDetail, updateTenantPlan, suspendTenant, reactivateTenant } from '../../lib/adminClient.js'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function TenantDetailModal({ tenantId, onClose }) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedPlan, setSelectedPlan] = useState('free')
  const [planLoading, setPlanLoading] = useState(false)
  const [planFeedback, setPlanFeedback] = useState(null)

  const [suspendLoading, setSuspendLoading] = useState(false)
  const [suspendFeedback, setSuspendFeedback] = useState(null)

  const loadTenant = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAdminTenantDetail(tenantId)
      .then(data => {
        setTenant(data.tenant)
        setSelectedPlan(data.tenant?.subscription?.plan?.slug ?? 'free')
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [tenantId])

  useEffect(() => { loadTenant() }, [loadTenant])

  async function handlePlanChange() {
    setPlanLoading(true)
    setPlanFeedback(null)
    try {
      await updateTenantPlan(tenantId, selectedPlan)
      setPlanFeedback({ ok: true, msg: 'Plano alterado com sucesso.' })
      loadTenant()
    } catch (err) {
      setPlanFeedback({ ok: false, msg: err.message })
    } finally {
      setPlanLoading(false)
    }
  }

  async function handleSuspend() {
    setSuspendLoading(true)
    setSuspendFeedback(null)
    const isActive = tenant?.subscription?.status === 'active'
    try {
      if (isActive) {
        await suspendTenant(tenantId)
        setSuspendFeedback({ ok: true, msg: 'Tenant suspenso com sucesso.' })
      } else {
        await reactivateTenant(tenantId)
        setSuspendFeedback({ ok: true, msg: 'Tenant reativado com sucesso.' })
      }
      loadTenant()
    } catch (err) {
      setSuspendFeedback({ ok: false, msg: err.message })
    } finally {
      setSuspendLoading(false)
    }
  }

  const subscriptionStatus = tenant?.subscription?.status ?? null
  const isActive = subscriptionStatus === 'active'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal admin-tenant-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Detalhes do Tenant</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-form">
          {loading && (
            <p className="admin-dashboard__loading">Carregando...</p>
          )}

          {error && (
            <p className="admin-dashboard__error">Erro: {error}</p>
          )}

          {!loading && !error && tenant && (
            <>
              <div className="admin-detail-grid">
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">Nome</span>
                  <span className="admin-detail-field__value">{tenant.name ?? '—'}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">Slug</span>
                  <span className="admin-detail-field__value admin-table__slug">{tenant.slug ?? '—'}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">Plano</span>
                  <span className="admin-detail-field__value">{tenant.plan ?? '—'}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">Status da Assinatura</span>
                  <span className="admin-detail-field__value">{tenant.subscription_status ?? '—'}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">E-mail do Owner</span>
                  <span className="admin-detail-field__value">{tenant.owner_email ?? '—'}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-field__label">Criado em</span>
                  <span className="admin-detail-field__value">{formatDate(tenant.created_at)}</span>
                </div>
              </div>

              {Array.isArray(tenant.members) && tenant.members.length > 0 && (
                <div className="admin-detail-members">
                  <p className="admin-detail-members__title">Membros Ativos</p>
                  <ul className="admin-detail-members__list">
                    {tenant.members.map((m, i) => (
                      <li key={m.id ?? i} className="admin-detail-members__item">
                        <span className="admin-detail-members__name">{m.name ?? m.email ?? '—'}</span>
                        {m.email && m.name && (
                          <span className="admin-detail-members__email">{m.email}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="admin-detail-actions">
                <p className="admin-detail-actions__title">Ações Administrativas</p>

                <div>
                  <div className="admin-detail-actions__row">
                    <select
                      className="admin-detail-actions__select"
                      value={selectedPlan}
                      onChange={e => setSelectedPlan(e.target.value)}
                      disabled={planLoading}
                    >
                      <option value="free">Free</option>
                      <option value="growth">Growth</option>
                    </select>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={handlePlanChange}
                      disabled={planLoading}
                    >
                      {planLoading ? 'Alterando...' : 'Alterar Plano'}
                    </button>
                  </div>
                  {planFeedback && (
                    <p className={`admin-detail-actions__feedback admin-detail-actions__feedback--${planFeedback.ok ? 'success' : 'error'}`}>
                      {planFeedback.msg}
                    </p>
                  )}
                </div>

                <div>
                  <div className="admin-detail-actions__row">
                    <button
                      type="button"
                      className={`action-btn${isActive ? ' danger' : ''}`}
                      onClick={handleSuspend}
                      disabled={suspendLoading}
                    >
                      {suspendLoading
                        ? 'Processando...'
                        : isActive
                          ? 'Suspender Tenant'
                          : 'Reativar Tenant'}
                    </button>
                  </div>
                  {suspendFeedback && (
                    <p className={`admin-detail-actions__feedback admin-detail-actions__feedback--${suspendFeedback.ok ? 'success' : 'error'}`}>
                      {suspendFeedback.msg}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
