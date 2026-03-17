// src/components/Finance/AccountForm.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { realToCents } from '../../lib/finUtils'

const AccountForm = ({ account, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', type: 'checking' })
  const [balanceInput, setBalanceInput] = useState('0,00')

  useEffect(() => {
    if (account) {
      setForm({ name: account.name, type: account.type })
      // Usar toFixed(2) garante sempre dois casas decimais (ex: 150000 → "1500,00")
      setBalanceInput(((account.opening_balance ?? 0) / 100).toFixed(2).replace('.', ','))
    }
  }, [account])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, opening_balance: realToCents(balanceInput) })
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
