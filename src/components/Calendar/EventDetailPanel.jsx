// src/components/Calendar/EventDetailPanel.jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle, DollarSign, Phone, Plus, Edit } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { centsToReal, realToCents } from '../../lib/finUtils'

/**
 * Slide-in panel showing contextual actions for a selected CalendarEvent.
 *
 * Props:
 *   event                        - CalendarEvent (from useCalendarEvents)
 *   onClose                      - () => void
 *   clients, tasks, team, columns
 *   onUpdateTask                 - (id, updates) => void — from App.jsx
 *   onUpdateActivity             - (id, updates) => void — from useActivities in CalendarView
 *   onInvoice                    - (receivableId, amountCents, date) => void
 *   onAddActivity                - (form) => void
 *   onAddTask                    - (form) => void — from App.jsx
 *   createReceivableFromActivity - (activityId, amount, accountId, dueDate) => Promise
 *   principalAccountId           - number|null
 */
export default function EventDetailPanel({
  event,
  onClose,
  clients = [],
  tasks = [],
  team = [],
  columns = [],
  onUpdateTask,
  onUpdateActivity,
  onInvoice,
  onAddActivity,
  onAddTask,
  createReceivableFromActivity,
  principalAccountId,
}) {
  const [innerModal, setInnerModal] = useState(null)
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10) })
  const [receivableForm, setReceivableForm] = useState({ amount: '', dueDate: new Date().toISOString().slice(0, 10) })

  if (!event) return null

  const { type, payload } = event

  const handleInvoiceConfirm = () => {
    const cents = realToCents(invoiceForm.amount)
    if (!cents || !invoiceForm.date) return
    onInvoice?.(payload.id, cents, invoiceForm.date)
    setInnerModal(null)
    onClose()
  }

  const handleReceivableConfirm = async () => {
    const cents = realToCents(receivableForm.amount)
    if (!cents || cents <= 0) return
    if (!principalAccountId) {
      alert('Nenhuma conta Principal definida. Acesse Finanças → Contas.')
      return
    }
    await createReceivableFromActivity?.(payload.id, cents, principalAccountId, receivableForm.dueDate || null)
    setInnerModal(null)
    onClose()
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={e => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <h2>{event.title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {type === 'task'        && `Tarefa · ${event.date}`}
            {type === 'activity'    && `Atividade · ${event.date}`}
            {type === 'receivable'  && `A Receber · ${centsToReal(payload.amount)} · ${event.date}`}
            {type === 'transaction' && `Transação · ${centsToReal(Math.abs(payload.amount))} · ${event.date}`}
          </p>

          {/* TASK actions */}
          {type === 'task' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('editTask')}>
                <Edit size={14} /> Editar
              </button>
              {!payload.completed_at && (
                <button className="action-btn" onClick={() => {
                  onUpdateTask?.(payload.id, { status: columns[columns.length - 1]?.name ?? payload.status })
                  onClose()
                }}>
                  <CheckCircle size={14} /> Concluir
                </button>
              )}
              {payload.category === 'Vendas' && (
                <button className="action-btn" onClick={() => setInnerModal('invoice')}>
                  <DollarSign size={14} /> Faturar
                </button>
              )}
            </>
          )}

          {/* ACTIVITY actions */}
          {type === 'activity' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('editActivity')}>
                <Edit size={14} /> Editar
              </button>
              <button className="action-btn" onClick={() => setInnerModal('newTransaction')}>
                <DollarSign size={14} /> Criar Transação
              </button>
              <button className="action-btn" onClick={() => setInnerModal('newReceivable')}>
                <Plus size={14} /> Criar A Receber
              </button>
              <button className="action-btn" onClick={() => {
                onUpdateActivity?.(payload.id, { status: 'done' })
                onClose()
              }}>
                <CheckCircle size={14} /> Concluir
              </button>
            </>
          )}

          {/* RECEIVABLE actions */}
          {type === 'receivable' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('invoice')}>
                <DollarSign size={14} /> Faturar
              </button>
              <button className="action-btn" onClick={() => {
                onAddActivity?.({
                  title: `Follow-up: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`,
                  type: 'call',
                  status: 'pending',
                  scheduled_at: null,
                  related_to: [{ type: 'receivable', id: payload.id }],
                })
                onClose()
              }}>
                <Phone size={14} /> Follow-up
              </button>
              <button className="action-btn" onClick={() => {
                setInnerModal('newTask')
              }}>
                <Plus size={14} /> Criar Tarefa
              </button>
            </>
          )}

          {/* TRANSACTION actions */}
          {type === 'transaction' && (
            <>
              <button className="action-btn" onClick={() => {
                setInnerModal('newTask')
              }}>
                <Plus size={14} /> Criar Tarefa
              </button>
              <button className="action-btn" onClick={() => {
                onAddActivity?.({
                  title: payload.notes || 'Atividade vinculada',
                  type: 'note',
                  status: 'pending',
                  scheduled_at: null,
                  related_to: [{ type: 'transaction', id: payload.id }],
                })
                onClose()
              }}>
                <Plus size={14} /> Criar Atividade
              </button>
            </>
          )}

          {/* Inline invoice form */}
          {innerModal === 'invoice' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Valor recebido (R$)</label>
              <input
                className="form-input"
                type="text"
                value={invoiceForm.amount}
                placeholder="0,00"
                onChange={e => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
              />
              <label style={{ fontSize: 13 }}>Data</label>
              <input
                className="form-input"
                type="date"
                value={invoiceForm.date}
                onChange={e => setInvoiceForm(prev => ({ ...prev, date: e.target.value }))}
              />
              <button className="add-member-btn" onClick={handleInvoiceConfirm}>
                Confirmar faturamento
              </button>
            </div>
          )}

          {/* Inline A Receber form (activity → receivable) */}
          {innerModal === 'newReceivable' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Valor a receber (R$)</label>
              <input
                className="form-input"
                type="text"
                value={receivableForm.amount}
                placeholder="0,00"
                onChange={e => setReceivableForm(prev => ({ ...prev, amount: e.target.value }))}
              />
              <label style={{ fontSize: 13 }}>Previsão de recebimento</label>
              <input
                className="form-input"
                type="date"
                value={receivableForm.dueDate}
                onChange={e => setReceivableForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              <button className="add-member-btn" onClick={handleReceivableConfirm}>
                Criar A Receber
              </button>
            </div>
          )}

          {/* Inline new transaction form for activity → Transaction */}
          {innerModal === 'newTransaction' && (
            <div style={{ marginTop: 8, padding: '10px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Abra o módulo de Finanças para registrar uma transação vinculada a esta atividade.
            </div>
          )}

          {/* Inline new task form */}
          {innerModal === 'newTask' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Título da tarefa</label>
              <input
                className="form-input"
                type="text"
                defaultValue={
                  type === 'receivable'
                    ? `Cobrar: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`
                    : ''
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onAddTask?.({ title: e.target.value, status: columns[0]?.name ?? 'A Fazer', priority: 'Média' })
                    onClose()
                  }
                }}
                placeholder="Enter para confirmar"
                autoFocus
              />
              <button
                type="button"
                className="action-btn"
                onClick={e => {
                  const input = e.target.closest('[style]').querySelector('input')
                  onAddTask?.({ title: input?.value ?? '', status: columns[0]?.name ?? 'A Fazer', priority: 'Média' })
                  onClose()
                }}
              >
                Criar Tarefa
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
