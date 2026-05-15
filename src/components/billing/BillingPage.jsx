import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink, RefreshCw, Shield } from 'lucide-react'
import { useTenant } from '../../hooks/useTenant.js'
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  fetchTenantBillingOverview,
} from '../../lib/billingApi.js'
import { normalizeError } from '../../lib/mutationResult.js'

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Sob consulta'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}

function readBillingFeedback() {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  return url.searchParams.get('billing')?.trim() || ''
}

function clearBillingFeedback() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('billing')
  url.searchParams.delete('tab')
  url.searchParams.delete('settingsTab')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export default function BillingPage() {
  const { activeTenant, activeTenantId } = useTenant()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyPlanKey, setBusyPlanKey] = useState('')
  const [feedback, setFeedback] = useState(readBillingFeedback())

  async function loadOverview() {
    if (!activeTenantId) return
    setLoading(true)
    setError('')

    try {
      const data = await fetchTenantBillingOverview(activeTenantId)
      setOverview(data)
    } catch (loadError) {
      setError(normalizeError(loadError, { operation: 'billing.load' }).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId) return

    let active = true

    async function loadTenantBilling() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchTenantBillingOverview(activeTenantId)
        if (active) setOverview(data)
      } catch (loadError) {
        if (active) {
          setError(normalizeError(loadError, { operation: 'billing.load' }).message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTenantBilling()

    return () => {
      active = false
    }
  }, [activeTenantId])

  const manageable = overview?.manageable ?? false
  const subscription = overview?.subscription ?? null
  const usage = overview?.usage ?? {}
  const plans = overview?.plans ?? []
  const stripeConfigured = overview?.stripeConfigured ?? false
  const planLimits = subscription?.plan?.limits ?? {}

  const usageEntries = [
    { label: 'Usuários ativos', current: usage.active_members ?? 0, limit: planLimits.max_users ?? null },
    { label: 'Clientes', current: usage.clients ?? 0, limit: planLimits.max_clients ?? null },
    { label: 'Tarefas', current: usage.tasks ?? 0, limit: planLimits.max_tasks ?? null },
    { label: 'Atividades', current: usage.activities ?? 0, limit: planLimits.max_activities ?? null },
    { label: 'Transações', current: usage.transactions ?? 0, limit: planLimits.max_transactions ?? null },
  ]

  async function handleCheckout(planSlug, interval) {
    if (!activeTenantId) return
    const busyKey = `${planSlug}:${interval}`
    setBusyPlanKey(busyKey)
    setError('')

    try {
      const data = await createBillingCheckoutSession(activeTenantId, { planSlug, interval })
      if (data.url) {
        window.location.assign(data.url)
      } else {
        throw new Error('Checkout Stripe sem URL de redirecionamento.')
      }
    } catch (checkoutError) {
      setError(normalizeError(checkoutError, { operation: 'billing.checkout' }).message)
    } finally {
      setBusyPlanKey('')
    }
  }

  async function handlePortal() {
    if (!activeTenantId) return
    setBusyPlanKey('portal')
    setError('')

    try {
      const data = await createBillingPortalSession(activeTenantId)
      if (data.url) {
        window.location.assign(data.url)
      } else {
        throw new Error('Portal Stripe sem URL de redirecionamento.')
      }
    } catch (portalError) {
      setError(normalizeError(portalError, { operation: 'billing.portal' }).message)
    } finally {
      setBusyPlanKey('')
    }
  }

  return (
    <section style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Faturamento do espaço de trabalho</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {activeTenant ? `Plano atual e capacidade operacional de ${activeTenant.name}.` : 'Faturamento do espaço de trabalho ativo.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="icon-btn" onClick={() => loadOverview()} aria-label="Atualizar faturamento">
            <RefreshCw size={18} />
          </button>
          {manageable && subscription?.provider === 'stripe' && (
            <button type="button" className="export-btn" onClick={handlePortal} disabled={busyPlanKey === 'portal'}>
              <ExternalLink size={16} />
              <span>{busyPlanKey === 'portal' ? 'Abrindo portal...' : 'Gerenciar no Stripe'}</span>
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <div style={{
          borderRadius: 14,
          border: '1px solid color-mix(in srgb, var(--primary) 45%, transparent)',
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          padding: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span>
              {feedback === 'success' && 'Checkout concluído. Aguarde a sincronização do Stripe.'}
              {feedback === 'cancel' && 'Checkout cancelado. Nenhuma alteração foi aplicada.'}
              {feedback === 'portal' && 'Retorno do portal de faturamento recebido.'}
            </span>
            <button type="button" className="icon-btn" onClick={() => { setFeedback(''); clearBillingFeedback() }}>
              x
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(220, 38, 38, 0.35)',
          background: 'rgba(220, 38, 38, 0.12)',
          color: '#fecaca',
          padding: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 18, borderRadius: 16, border: '1px solid var(--border-color)' }}>
          Carregando faturamento do espaço de trabalho...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 16, padding: 18, background: 'var(--card-bg)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Plano atual</span>
              <h3 style={{ margin: '8px 0 4px' }}>{subscription?.plan?.name ?? 'Não identificado'}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{subscription?.plan?.description ?? 'Resumo indisponível.'}</p>
              <div style={{ marginTop: 18, display: 'grid', gap: 8, fontSize: 14 }}>
                <span>Status: <strong>{subscription?.status ?? '—'}</strong></span>
                <span>Provedor: <strong>{subscription?.provider ?? '—'}</strong></span>
                <span>Fim do período: <strong>{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'}</strong></span>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: 16, padding: 18, background: 'var(--card-bg)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Capacidade</span>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {usageEntries.map((entry) => (
                  <div key={entry.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{entry.label}</span>
                    <strong>{entry.current}/{entry.limit ?? 'ilimitado'}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!manageable && (
            <div style={{ color: 'var(--text-secondary)' }}>
              Apenas proprietários e admins podem iniciar upgrade, downgrade ou abrir o portal de faturamento.
            </div>
          )}

          {!stripeConfigured && (
            <div style={{
              padding: 18,
              borderRadius: 16,
              border: '1px solid color-mix(in srgb, var(--success, #16a34a) 35%, transparent)',
              background: 'color-mix(in srgb, var(--success, #16a34a) 8%, transparent)',
              display: 'grid',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={20} color="var(--success, #16a34a)" />
                <strong style={{ fontSize: 15 }}>Período de testes — sem custo</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                O faturamento será ativado em breve. Durante os testes, todos os recursos estão disponíveis sem limitações.
                {subscription?.plan?.name ? ` Seu plano atual é ${subscription.plan.name}.` : ''}
              </p>
            </div>
          )}

          {stripeConfigured && plans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {plans.map((plan) => {
                const isCurrentPlan = subscription?.plan?.slug === plan.slug
                return (
                  <article
                    key={plan.id}
                    style={{
                      border: isCurrentPlan ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      borderRadius: 16,
                      padding: 18,
                      background: 'var(--card-bg)',
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: '0 0 6px' }}>{plan.name}</h3>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{plan.description || 'Plano sem descrição comercial.'}</p>
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      <span>Mensal: <strong>{formatCurrency(plan.priceMonthly)}</strong></span>
                      <span>Anual: <strong>{formatCurrency(plan.priceYearly)}</strong></span>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <button
                        type="button"
                        className="export-btn"
                        disabled={!manageable || !stripeConfigured || !plan.monthlyAvailable || busyPlanKey === `${plan.slug}:monthly`}
                        onClick={() => handleCheckout(plan.slug, 'monthly')}
                      >
                        <CreditCard size={16} />
                        <span>
                          {busyPlanKey === `${plan.slug}:monthly`
                            ? 'Abrindo checkout...'
                            : isCurrentPlan ? 'Reconfigurar mensal' : 'Assinar mensal'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        style={{ justifyContent: 'center', width: '100%', padding: '10px 14px' }}
                        disabled={!manageable || !stripeConfigured || !plan.yearlyAvailable || busyPlanKey === `${plan.slug}:yearly`}
                        onClick={() => handleCheckout(plan.slug, 'yearly')}
                      >
                        {busyPlanKey === `${plan.slug}:yearly` ? 'Abrindo checkout anual...' : 'Assinar anual'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
