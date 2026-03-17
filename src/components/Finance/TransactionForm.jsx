// src/components/Finance/TransactionForm.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { realToCents } from '../../lib/finUtils'
import RelationChips from '../Activities/RelationChips'

const today = () => new Date().toISOString().split('T')[0]

const TransactionForm = ({
  transaction,
  accounts,
  payees,
  groups,
  categories,
  clients = [],
  tasks = [],
  team = [],
  onSave,
  onClose,
  addPayee,
}) => {
  const [form, setForm] = useState({
    account_id: '',
    amount: 0,
    date: today(),
    payee_id: null,
    payee_name: '',   // campo efêmero para rules engine; não vai para o DB
    category_id: null,
    notes: '',
    related_to: [],
    cleared: false,
  })
  const [amountInput, setAmountInput] = useState('')
  const [payeeSearch, setPayeeSearch] = useState('')
  const [showPayeeDropdown, setShowPayeeDropdown] = useState(false)
  const [creatingPayee, setCreatingPayee] = useState(false)

  useEffect(() => {
    if (transaction) {
      setForm({
        account_id:  transaction.account_id  || '',
        amount:      transaction.amount       || 0,
        date:        transaction.date         || today(),
        payee_id:    transaction.payee_id     || null,
        payee_name:  '',
        category_id: transaction.category_id  || null,
        notes:       transaction.notes        || '',
        related_to:  transaction.related_to   || [],
        cleared:     transaction.cleared      || false,
      })
      // Preservar sinal: despesas mostram "-150,00"; toFixed(2) garante duas casas decimais
      setAmountInput(transaction.amount != null
        ? (transaction.amount / 100).toFixed(2).replace('.', ',')
        : '')
      setPayeeSearch(payees.find(p => p.id === transaction.payee_id)?.name || '')
    } else if (accounts.length > 0) {
      setForm(p => ({ ...p, account_id: accounts[0].id }))
    }
  }, [transaction, accounts, payees])

  const change = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const handlePayeeSelect = (payee) => {
    change('payee_id', payee.id)
    change('payee_name', payee.name)
    setPayeeSearch(payee.name)
    setShowPayeeDropdown(false)
  }

  const handleCreatePayee = async () => {
    if (!payeeSearch.trim() || !addPayee || creatingPayee) return
    setCreatingPayee(true)
    const newPayee = await addPayee(payeeSearch.trim())
    setCreatingPayee(false)
    if (newPayee) handlePayeeSelect(newPayee)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.account_id || !amountInput.trim()) return
    const cents = realToCents(amountInput)
    if (cents === 0) return
    onSave({ ...form, amount: cents })
  }

  const filteredPayees = payees.filter(p =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase())
  )
  const visibleCategories = categories.filter(c => !c.hidden)
  const exactMatch = filteredPayees.some(p => p.name.toLowerCase() === payeeSearch.toLowerCase())

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal modal-wide"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{transaction ? 'Editar Transação' : 'Nova Transação'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Conta *</label>
              <select
                value={form.account_id}
                onChange={e => change('account_id', Number(e.target.value))}
              >
                <option value="">Selecione...</option>
                {accounts.filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Valor (R$) *</label>
              <input
                type="text"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="150,00 ou -150,00"
              />
              <small className="form-hint">Negativo = despesa. Ex: -150,00</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => change('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select
                value={form.category_id || ''}
                onChange={e => change('category_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Sem categoria</option>
                {groups.map(group => (
                  <optgroup key={group.id} label={group.name}>
                    {visibleCategories.filter(c => c.group_id === group.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Pagador</label>
            <div className="payee-input-wrapper">
              <input
                type="text"
                value={payeeSearch}
                onChange={e => {
                  setPayeeSearch(e.target.value)
                  setShowPayeeDropdown(true)
                  change('payee_id', null)
                  change('payee_name', e.target.value)
                }}
                onFocus={() => setShowPayeeDropdown(true)}
                placeholder="Buscar ou criar pagador..."
                autoComplete="off"
              />
              {showPayeeDropdown && payeeSearch.trim() && (
                <div className="payee-dropdown">
                  {filteredPayees.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="payee-option"
                      onClick={() => handlePayeeSelect(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                  {!exactMatch && (
                    <button type="button" className="payee-option create" onClick={handleCreatePayee}>
                      <Plus size={12} /> Criar &quot;{payeeSearch}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => change('notes', e.target.value)}
              placeholder="Observações..."
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Vínculos</label>
            <RelationChips
              value={form.related_to}
              onChange={v => change('related_to', v)}
              clients={clients}
              tasks={tasks}
              team={team}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.cleared}
                onChange={e => change('cleared', e.target.checked)}
              />
              Conciliado
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn" disabled={creatingPayee}>
              {creatingPayee ? 'Criando pagador...' : transaction ? 'Salvar' : 'Criar Transação'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default TransactionForm
