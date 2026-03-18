// src/components/Finance/AccountForm.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { realToCents } from '../../lib/finUtils'

const AccountForm = ({ account, onSave, onClose, categories, existingPrincipal }) => {
  const [form, setForm] = useState({ name: '', type: 'checking', category: 'extras' })
  const [balanceInput, setBalanceInput] = useState('0,00')
  const [showDemoteConfirm, setShowDemoteConfirm] = useState(false)
  const [demotedCategory, setDemotedCategory] = useState('extras')

  useEffect(() => {
    if (account) {
      setForm({ name: account.name, type: account.type, category: account.category ?? 'extras' })
      // Usar toFixed(2) garante sempre dois casas decimais (ex: 150000 → "1500,00")
      setBalanceInput(((account.opening_balance ?? 0) / 100).toFixed(2).replace('.', ','))
    }
  }, [account])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const safeCategory = form.category === '__new__' ? 'extras' : form.category
    if (safeCategory === 'principal' && existingPrincipal && existingPrincipal.id !== account?.id) {
      setShowDemoteConfirm(true)
      return
    }
    onSave({ ...form, category: safeCategory, opening_balance: realToCents(balanceInput) }, undefined)
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{account ? 'Editar Conta' : 'Nova Conta'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome da Conta *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Conta Bradesco"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="checking">Conta Corrente</option>
              <option value="savings">Poupança</option>
              <option value="credit">Cartão de Crédito</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
          <div className="form-group">
            <label>Saldo Inicial (R$)</label>
            <input
              type="text"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={form.category === '__new__' ? '__new__' : form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="form-input"
                style={{ flex: 1 }}
              >
                {(categories || ['principal', 'reserva', 'extras']).map(c => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
                <option value="__new__">+ Nova categoria</option>
              </select>
              {form.category === '__new__' && (
                <input
                  autoFocus
                  className="form-input"
                  placeholder="Nome da categoria"
                  style={{ flex: 1 }}
                  onBlur={e => {
                    const val = e.target.value.trim().toLowerCase()
                    setForm(f => ({ ...f, category: val || 'extras' }))
                  }}
                />
              )}
            </div>
          </div>
          {showDemoteConfirm && (
            <div style={{
              background: 'var(--bg-secondary, #f3f4f6)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 12
            }}>
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>
                A conta <strong>{existingPrincipal?.name}</strong> deixará de ser Principal.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13 }}>Passar para:</label>
                <select
                  value={demotedCategory}
                  onChange={e => setDemotedCategory(e.target.value)}
                  className="form-input"
                  style={{ width: 'auto' }}
                >
                  <option value="extras">Extras</option>
                  <option value="reserva">Reserva</option>
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => { setShowDemoteConfirm(false); onSave({ ...form, category: form.category === '__new__' ? 'extras' : form.category, opening_balance: realToCents(balanceInput) }, demotedCategory) }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowDemoteConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">{account ? 'Salvar' : 'Criar Conta'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default AccountForm
