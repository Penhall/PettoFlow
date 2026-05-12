import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  fetchAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
} from '../../lib/adminClient.js'

const EMPTY_FORM = {
  name: '',
  slug: '',
  price_monthly: '',
  price_yearly: '',
  max_users: '',
  max_clients: '',
  max_tasks: '',
  max_activities: '',
  max_transactions: '',
  active: true,
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatBRL(value) {
  if (value == null || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function limitsLabel(limits) {
  if (!limits || typeof limits !== 'object') return '—'
  const parts = []
  if (limits.max_users != null) parts.push(`${limits.max_users} usuários`)
  if (limits.max_clients != null) parts.push(`${limits.max_clients} clientes`)
  if (limits.max_tasks != null) parts.push(`${limits.max_tasks} tarefas`)
  return parts.length ? parts.join(', ') : 'Sem limites'
}

function formToPayload(form) {
  const limits = {}
  const toNum = (v) => v === '' || v === undefined ? undefined : Number(v)
  const mu = toNum(form.max_users)
  const mc = toNum(form.max_clients)
  const mt = toNum(form.max_tasks)
  const ma = toNum(form.max_activities)
  const mtr = toNum(form.max_transactions)
  if (mu !== undefined) limits.max_users = mu
  if (mc !== undefined) limits.max_clients = mc
  if (mt !== undefined) limits.max_tasks = mt
  if (ma !== undefined) limits.max_activities = ma
  if (mtr !== undefined) limits.max_transactions = mtr

  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    price_monthly: form.price_monthly === '' ? 0 : Number(form.price_monthly),
    price_yearly: form.price_yearly === '' ? 0 : Number(form.price_yearly),
    limits,
    active: form.active,
  }
}

function planToForm(plan) {
  const limits = plan.limits ?? {}
  return {
    name: plan.name ?? '',
    slug: plan.slug ?? '',
    price_monthly: plan.price_monthly ?? '',
    price_yearly: plan.price_yearly ?? '',
    max_users: limits.max_users ?? '',
    max_clients: limits.max_clients ?? '',
    max_tasks: limits.max_tasks ?? '',
    max_activities: limits.max_activities ?? '',
    max_transactions: limits.max_transactions ?? '',
    active: plan.active !== false,
  }
}

function PlanoFormModal({ plan, onClose, onSaved }) {
  const isEdit = Boolean(plan)
  const [form, setForm] = useState(isEdit ? planToForm(plan) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || (!isEdit && prev.slug === slugify(prev.name))
        ? slugify(name)
        : prev.slug,
    }))
  }

  const handleField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (!form.slug.trim()) { setError('Slug é obrigatório'); return }

    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (isEdit) {
        await updateAdminPlan(plan.id, payload)
      } else {
        await createAdminPlan(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">{isEdit ? 'Editar Plano' : 'Novo Plano'}</h2>
          <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={handleSubmit} className="admin-plans-form">
          <div className="admin-plans-form__row">
            <div className="admin-plans-form__field">
              <label htmlFor="plan-name">Nome</label>
              <input
                id="plan-name"
                type="text"
                value={form.name}
                onChange={handleNameChange}
                placeholder="Ex: Growth"
                autoFocus
              />
            </div>
            <div className="admin-plans-form__field">
              <label htmlFor="plan-slug">Slug</label>
              <input
                id="plan-slug"
                type="text"
                value={form.slug}
                onChange={handleField('slug')}
                placeholder="Ex: growth"
              />
            </div>
          </div>

          <div className="admin-plans-form__row">
            <div className="admin-plans-form__field">
              <label htmlFor="plan-price-monthly">Preço Mensal (R$)</label>
              <input
                id="plan-price-monthly"
                type="number"
                min="0"
                step="0.01"
                value={form.price_monthly}
                onChange={handleField('price_monthly')}
                placeholder="0.00"
              />
            </div>
            <div className="admin-plans-form__field">
              <label htmlFor="plan-price-yearly">Preço Anual (R$)</label>
              <input
                id="plan-price-yearly"
                type="number"
                min="0"
                step="0.01"
                value={form.price_yearly}
                onChange={handleField('price_yearly')}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="admin-plans-form__limits-title">Limites (0 = sem limite)</div>

          <div className="admin-plans-form__row">
            <div className="admin-plans-form__field">
              <label htmlFor="plan-max-users">Usuários</label>
              <input
                id="plan-max-users"
                type="number"
                min="0"
                value={form.max_users}
                onChange={handleField('max_users')}
                placeholder="0"
              />
            </div>
            <div className="admin-plans-form__field">
              <label htmlFor="plan-max-clients">Clientes</label>
              <input
                id="plan-max-clients"
                type="number"
                min="0"
                value={form.max_clients}
                onChange={handleField('max_clients')}
                placeholder="0"
              />
            </div>
            <div className="admin-plans-form__field">
              <label htmlFor="plan-max-tasks">Tarefas</label>
              <input
                id="plan-max-tasks"
                type="number"
                min="0"
                value={form.max_tasks}
                onChange={handleField('max_tasks')}
                placeholder="0"
              />
            </div>
          </div>

          <div className="admin-plans-form__row">
            <div className="admin-plans-form__field">
              <label htmlFor="plan-max-activities">Atividades</label>
              <input
                id="plan-max-activities"
                type="number"
                min="0"
                value={form.max_activities}
                onChange={handleField('max_activities')}
                placeholder="0"
              />
            </div>
            <div className="admin-plans-form__field">
              <label htmlFor="plan-max-transactions">Transações</label>
              <input
                id="plan-max-transactions"
                type="number"
                min="0"
                value={form.max_transactions}
                onChange={handleField('max_transactions')}
                placeholder="0"
              />
            </div>
          </div>

          <div className="admin-plans-form__checkbox">
            <input
              id="plan-active"
              type="checkbox"
              checked={form.active}
              onChange={handleField('active')}
            />
            <label htmlFor="plan-active">Plano ativo</label>
          </div>

          {error && <p className="admin-dashboard__error">{error}</p>}

          <div className="admin-modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ plan, onClose, onConfirm, deleting }) {
  const blocked = (plan.active_subscriptions_count ?? 0) > 0
  const isProtected = plan.slug === 'free'

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">Excluir plano</h2>
          <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {isProtected ? (
          <p className="admin-dashboard__error">O plano <strong>{plan.name}</strong> não pode ser excluído pois é o plano padrão do sistema.</p>
        ) : blocked ? (
          <p className="admin-dashboard__error">
            O plano <strong>{plan.name}</strong> possui {plan.active_subscriptions_count} assinatura(s) ativa(s).
            Remova ou migre os tenants antes de excluir.
          </p>
        ) : (
          <p>Tem certeza que deseja excluir o plano <strong>{plan.name}</strong>? Esta ação não pode ser desfeita.</p>
        )}

        <div className="admin-modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          {!blocked && !isProtected && (
            <button
              type="button"
              className="btn-danger"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir plano'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [deletingPlan, setDeletingPlan] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchAdminPlans()
      .then((data) => { setPlans(data.plans ?? []); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleSaved = () => {
    setShowForm(false)
    setEditingPlan(null)
    load()
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPlan) return
    setDeleting(true)
    try {
      await deleteAdminPlan(deletingPlan.id)
      setDeletingPlan(null)
      load()
    } catch (err) {
      setError(err.message)
      setDeletingPlan(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-plans">
        <p className="admin-dashboard__loading">Carregando planos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-plans">
        <p className="admin-dashboard__error">Erro: {error}</p>
      </div>
    )
  }

  return (
    <div className="admin-plans">
      <div className="admin-plans__toolbar">
        <h1 className="admin-section-title">Planos</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setEditingPlan(null); setShowForm(true) }}
        >
          Novo Plano
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="admin-panel__empty">Nenhum plano configurado</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Preço Mensal</th>
                <th>Preço Anual</th>
                <th>Limites</th>
                <th>Ativo</th>
                <th>Assinaturas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.name}</td>
                  <td className="admin-table__slug">{plan.slug}</td>
                  <td>{formatBRL(plan.price_monthly)}</td>
                  <td>{formatBRL(plan.price_yearly)}</td>
                  <td>{limitsLabel(plan.limits)}</td>
                  <td>{plan.active ? 'Sim' : 'Não'}</td>
                  <td>{plan.active_subscriptions_count ?? 0}</td>
                  <td>
                    <div className="admin-plans__actions">
                      <button
                        type="button"
                        className="admin-plans__action-btn"
                        title="Editar"
                        aria-label={`Editar plano ${plan.name}`}
                        onClick={() => { setEditingPlan(plan); setShowForm(true) }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-plans__action-btn admin-plans__action-btn--danger"
                        title="Excluir"
                        aria-label={`Excluir plano ${plan.name}`}
                        onClick={() => setDeletingPlan(plan)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PlanoFormModal
          plan={editingPlan}
          onClose={() => { setShowForm(false); setEditingPlan(null) }}
          onSaved={handleSaved}
        />
      )}

      {deletingPlan && (
        <DeleteConfirmModal
          plan={deletingPlan}
          onClose={() => setDeletingPlan(null)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}
    </div>
  )
}
