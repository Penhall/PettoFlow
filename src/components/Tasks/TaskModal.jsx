import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import RelationChips from '../Activities/RelationChips'
import { DollarSign } from 'lucide-react'
import TransactionForm      from '../Finance/TransactionForm'
import { useAccounts }      from '../../hooks/useAccounts'
import { usePayees }        from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import { useTransactions }  from '../../hooks/useTransactions'

const TaskModal = ({ task, onSave, onClose, defaultStatus, team = [], clients = [], tasks = [] }) => {
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
  })

  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const { accounts }               = useAccounts()
  const { payees, addPayee }       = usePayees()
  const { groups, categories }     = useFinCategories()
  const { addTransaction }         = useTransactions()

  useEffect(() => {
    if (task) {
      setForm({
        ...task,
        tags: task.tags || [],
        deal_value: task.deal_value || 0,
        client_id: task.client_id || null,
        category: task.category || 'Operacional',
        related_to: task.related_to || [],
      })
    }
  }, [task])

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave(form)
  }

  const handleSaveTransaction = async (txForm) => {
    await addTransaction(txForm)
    setShowTransactionForm(false)
  }

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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
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
                <option>A Fazer</option>
                <option>Em Progresso</option>
                <option>Concluído</option>
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
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
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
          <TransactionForm
            transaction={task?.id ? { related_to: [{ type: 'task', id: task.id, label: task.title }] } : undefined}
            accounts={accounts}
            payees={payees}
            groups={groups}
            categories={categories}
            clients={clients}
            tasks={tasks}
            team={team}
            onSave={handleSaveTransaction}
            onClose={() => setShowTransactionForm(false)}
            addPayee={addPayee}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default TaskModal
