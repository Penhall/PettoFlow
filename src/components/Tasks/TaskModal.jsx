import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, DollarSign, CheckCircle, Clock, Archive } from 'lucide-react'
import RelationChips from '../Activities/RelationChips'
import TransactionForm      from '../Finance/TransactionForm'
import { useAccounts }      from '../../hooks/useAccounts'
import { usePayees }        from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import { useTransactions }  from '../../hooks/useTransactions'
import { useReceivables }   from '../../hooks/useReceivables'
import { centsToReal, realToCents } from '../../lib/finUtils'

const TransactionFormWrapper = ({ task, clients, tasks, team, onClose }) => {
  const { accounts }           = useAccounts()
  const { payees, addPayee }   = usePayees()
  const { groups, categories } = useFinCategories()
  const { addTransaction }     = useTransactions()

  const handleSave = async (txForm) => {
    await addTransaction(txForm)
    onClose()
  }

  return (
    <TransactionForm
      transaction={task?.id ? { related_to: [{ type: 'task', id: task.id, label: task.title }] } : undefined}
      accounts={accounts}
      payees={payees}
      groups={groups}
      categories={categories}
      clients={clients}
      tasks={tasks}
      team={team}
      onSave={handleSave}
      onClose={onClose}
      addPayee={addPayee}
    />
  )
}

const TaskModal = ({ task, onSave, onClose, onArchive, defaultStatus, team = [], clients = [], tasks = [], columns = [] }) => {
  const [form, setForm] = useState({
    title: '',
    status: defaultStatus || 'A Fazer',
    priority: 'Média',
    owner: '',
    tags: [],
    progress: 0,
    deal_value: 0,
    client_id: null,
    category: 'Operacional',
    related_to: [],
    due_date: '',
  })

  const [showTransactionForm, setShowTransactionForm] = useState(false)

  const { listReceivables, invoiceReceivable } = useReceivables()
  const { addTransaction } = useTransactions()

  // Get the receivable for this specific task (null if none)
  const taskReceivable = task ? (listReceivables({ taskId: Number(task.id) })[0] ?? null) : null

  // Local state for invoice form
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({
        ...task,
        tags: task.tags || [],
        deal_value: task.deal_value || 0,
        client_id: task.client_id || null,
        category: task.category || 'Operacional',
        related_to: task.related_to || [],
        due_date: task?.due_date
          ? new Date(task.due_date).toISOString().slice(0, 10)
          : '',
      })
    }
  }, [task])

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave(form)
  }

  // Em telas mobile, o modal vira bottom sheet com animação de slide-up
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const sheetVariants = isMobile
    ? { hidden: { y: 80, opacity: 0 }, visible: { y: 0, opacity: 1 }, exit: { y: 80, opacity: 0 } }
    : { hidden: { scale: 0.95, opacity: 0 }, visible: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 } }

  return (
    <>
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        variants={sheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Receivable status badge */}
          {task && taskReceivable && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: taskReceivable.status === 'pending'
                ? 'var(--warning-bg, #fef3c7)'
                : 'var(--success-bg, #d1fae5)',
              borderRadius: 6,
              marginBottom: 12,
            }}>
              {taskReceivable.status === 'pending' ? (
                <>
                  <Clock size={14} style={{ color: '#d97706' }} />
                  <span style={{ flex: 1, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
                    Aguardando Faturamento · {centsToReal(taskReceivable.amount)}
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      setInvoiceAmount((taskReceivable.amount / 100).toFixed(2).replace('.', ','))
                      setInvoiceDate(new Date().toISOString().slice(0, 10))
                      setShowInvoiceForm(true)
                    }}
                  >
                    <CheckCircle size={13} /> Faturar
                  </button>
                </>
              ) : (
                <>
                  <CheckCircle size={14} style={{ color: '#059669' }} />
                  <span style={{ fontSize: 13, color: '#065f46', fontWeight: 500 }}>
                    Faturado ✓ · {centsToReal(taskReceivable.amount)}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Invoice confirmation form */}
          {showInvoiceForm && taskReceivable && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 12,
            }}>
              <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: 14 }}>Confirmar Faturamento</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Valor recebido</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoiceAmount}
                    onChange={e => setInvoiceAmount(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>Data</label>
                  <input
                    type="date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    const cents = realToCents(invoiceAmount)
                    if (!cents || cents <= 0) return
                    await invoiceReceivable(taskReceivable.id, cents, invoiceDate, addTransaction)
                    setShowInvoiceForm(false)
                  }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowInvoiceForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => change('title', e.target.value)}
              placeholder="Nome da tarefa"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoria</label>
              <select value={form.category} onChange={e => change('category', e.target.value)}>
                <option value="Operacional">Operacional</option>
                <option value="Vendas">Vendas</option>
                <option value="Pessoal">Pessoal</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select value={form.priority} onChange={e => change('priority', e.target.value)}>
                <option>Alta</option>
                <option>Média</option>
                <option>Baixa</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => change('status', e.target.value)}>
                {columns.length > 0 ? (
                  columns.map(col => (
                    <option key={col.id || col.name} value={col.name}>{col.name}</option>
                  ))
                ) : (
                  <>
                    <option>A Fazer</option>
                    <option>Em Progresso</option>
                    <option>Concluído</option>
                  </>
                )}
              </select>
            </div>
            <div className="form-group">
              <label>Valor (R$)</label>
              <input
                type="number"
                value={form.deal_value}
                onChange={e => change('deal_value', Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Membro do Time</label>
              <select value={form.owner} onChange={e => change('owner', e.target.value)}>
                <option value="">Selecione...</option>
                {team && team.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cliente / Lead</label>
              <select value={form.client_id || ""} onChange={e => change('client_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Selecione...</option>
                {clients && clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Prazo (opcional)</label>
            <input
              type="date"
              className="form-input"
              value={form.due_date || ''}
              onChange={e => change('due_date', e.target.value || null)}
            />
          </div>

          <div className="form-group">
            <label>Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={form.tags.join(', ')}
              onChange={e => change('tags', e.target.value.split(',').map(t => t.trim().startsWith('#') ? t.trim() : '#' + t.trim()).filter(t => t !== '#'))}
              placeholder="ex: Design, UX, Pesquisa"
            />
          </div>

          <div className="form-group">
            <label>Progresso: {form.progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={form.progress}
              onChange={e => change('progress', Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Vínculos</label>
            <RelationChips
              value={form.related_to}
              onChange={v => change('related_to', v)}
              clients={clients}
              tasks={[]}
              team={team}
            />
          </div>

          <div className="modal-actions">
            {/* Archive confirmation inline */}
            {showArchiveConfirm && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: 'var(--danger-bg, #fee2e2)',
                borderRadius: 6,
                fontSize: 13,
                width: '100%',
                marginBottom: 8,
              }}>
                <span style={{ flex: 1 }}>Arquivar esta tarefa?</span>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#dc2626', fontSize: 12 }}
                  onClick={() => { onArchive?.(task.id); onClose() }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => setShowArchiveConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            )}

            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>

            {task && !task.archived_at && onArchive && (
              <button
                type="button"
                className="action-btn"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setShowArchiveConfirm(true)}
              >
                <Archive size={14} style={{ marginRight: 4 }} /> Arquivar
              </button>
            )}

            <button type="button" className="action-btn" onClick={() => setShowTransactionForm(true)}>
              <DollarSign size={14} style={{ marginRight: 4 }} />Vincular Transação
            </button>
            <button type="submit" className="add-member-btn">{task ? 'Salvar' : 'Criar Tarefa'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>

      <AnimatePresence>
        {showTransactionForm && (
          <TransactionFormWrapper
            task={task}
            clients={clients}
            tasks={tasks}
            team={team}
            onClose={() => setShowTransactionForm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default TaskModal
