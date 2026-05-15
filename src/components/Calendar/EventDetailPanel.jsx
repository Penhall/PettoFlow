import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, DollarSign, Edit, Phone, Plus, X } from 'lucide-react'
import { centsToReal, realToCents } from '../../lib/finUtils'
import { getMutationMessage, isMutationOk } from '../../lib/mutationResult.js'
import { MOTION_TRANSITIONS } from '../../lib/motionTokens.js'

function DetailAction({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className="calendar-detail__action" onClick={onClick}>
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}

function DetailField({ label, children }) {
  return (
    <label className="calendar-detail__field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export default function EventDetailPanel({
  event,
  onClose,
  columns = [],
  onUpdateTask,
  onUpdateActivity,
  onInvoice,
  onAddActivity,
  onAddTask,
  createReceivableFromActivity,
  principalAccountId,
  contextArea,
}) {
  const [innerMode, setInnerMode] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [invoiceForm, setInvoiceForm] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [receivableForm, setReceivableForm] = useState({
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
  })
  const [error, setError] = useState('')

  if (!event) return null

  const { type, payload } = event
  const detailMeta = {
    task: `Tarefa · ${event.date}`,
    activity: `Atividade · ${event.date}`,
    receivable: `A receber · ${centsToReal(payload.amount)} · ${event.date}`,
    transaction: `Transação · ${centsToReal(Math.abs(payload.amount))} · ${event.date}`,
  }[type]

  const createQuickTask = async () => {
    if (!newTaskTitle.trim()) return

    setError('')
    const result = await onAddTask?.({
      title: newTaskTitle,
      status: columns[0]?.name ?? 'A Fazer',
      priority: 'Média',
    })
    if (!isMutationOk(result)) {
      setError(getMutationMessage(result))
      return
    }
    onClose()
  }

  const handleInvoiceConfirm = async () => {
    const cents = realToCents(invoiceForm.amount)
    if (!cents || !invoiceForm.date) return

    setError('')
    const result = await onInvoice?.(payload.id, cents, invoiceForm.date)
    if (!isMutationOk(result)) {
      setError(getMutationMessage(result))
      return
    }
    setInnerMode(null)
    onClose()
  }

  const handleReceivableConfirm = async () => {
    const cents = realToCents(receivableForm.amount)
    if (!cents || cents <= 0) return

    if (!principalAccountId) {
      setError('Defina uma conta principal em Finanças > Contas antes de faturar.')
      return
    }

    setError('')
    const result = await createReceivableFromActivity?.(payload.id, cents, principalAccountId, receivableForm.dueDate || null)
    if (!isMutationOk(result)) {
      setError(getMutationMessage(result))
      return
    }
    setInnerMode(null)
    onClose()
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MOTION_TRANSITIONS.fade}
    >
      <motion.div
        className="modal calendar-detail-modal"
        onClick={(eventObject) => eventObject.stopPropagation()}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={MOTION_TRANSITIONS.modal}
      >
        <div className="modal-header">
          <div>
            <h2>{event.title}</h2>
            <p className="calendar-detail__meta">{detailMeta}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="calendar-detail">
          {error ? (
            <p className="calendar-detail__error">{error}</p>
          ) : null}

          <div className="calendar-detail__actions">
            {type === 'task' ? (
              <>
                <DetailAction icon={Edit} label="Editar" onClick={() => setInnerMode('editTask')} />
                {!payload.completed_at ? (
                  <DetailAction
                    icon={CheckCircle}
                    label="Concluir"
                    onClick={async () => {
                      setError('')
                      const result = await onUpdateTask?.(payload.id, { status: columns[columns.length - 1]?.name ?? payload.status })
                      if (!isMutationOk(result)) {
                        setError(getMutationMessage(result))
                        return
                      }
                      onClose()
                    }}
                  />
                ) : null}
                {payload.category === 'Vendas' ? (
                  <DetailAction icon={DollarSign} label="Faturar" onClick={() => setInnerMode('invoice')} />
                ) : null}
              </>
            ) : null}

            {type === 'activity' ? (
              <>
                <DetailAction icon={Edit} label="Editar" onClick={() => setInnerMode('editActivity')} />
                <DetailAction icon={DollarSign} label="Criar transação" onClick={() => setInnerMode('newTransaction')} />
                <DetailAction icon={Plus} label="Criar a receber" onClick={() => setInnerMode('newReceivable')} />
                <DetailAction
                  icon={CheckCircle}
                  label="Concluir"
                  onClick={() => {
                    onUpdateActivity?.(payload.id, { status: 'completed' })
                    onClose()
                  }}
                />
              </>
            ) : null}

            {type === 'receivable' ? (
              <>
                <DetailAction icon={DollarSign} label="Faturar" onClick={() => setInnerMode('invoice')} />
                {contextArea !== 'financas' ? (
                  <DetailAction
                    icon={Phone}
                    label="Follow-up"
                    onClick={() => {
                      onAddActivity?.({
                        title: `Follow-up: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`,
                        type: 'call',
                        status: 'pending',
                        scheduled_at: null,
                        related_to: [{ type: 'receivable', id: payload.id }],
                      })
                      onClose()
                    }}
                  />
                ) : null}
                {contextArea !== 'financas' ? (
                  <DetailAction
                    icon={Plus}
                    label="Criar tarefa"
                    onClick={() => {
                      setNewTaskTitle(`Cobrar: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`)
                      setInnerMode('newTask')
                    }}
                  />
                ) : null}
              </>
            ) : null}

            {type === 'transaction' && contextArea !== 'financas' ? (
              <>
                <DetailAction
                  icon={Plus}
                  label="Criar tarefa"
                  onClick={() => {
                    setNewTaskTitle('')
                    setInnerMode('newTask')
                  }}
                />
                <DetailAction
                  icon={Plus}
                  label="Criar atividade"
                  onClick={() => {
                    onAddActivity?.({
                      title: payload.notes || 'Atividade vinculada',
                      type: 'note',
                      status: 'pending',
                      scheduled_at: null,
                      related_to: [{ type: 'transaction', id: payload.id }],
                    })
                    onClose()
                  }}
                />
              </>
            ) : null}
          </div>

          {innerMode === 'invoice' ? (
            <div className="calendar-detail__panel">
              <div className="calendar-detail__panel-header">
                <strong>Confirmar faturamento</strong>
                <span>Registre o valor recebido e a data de conciliação.</span>
              </div>

              <div className="calendar-detail__form">
                <DetailField label="Valor recebido (R$)">
                  <input
                    className="form-input"
                    type="text"
                    value={invoiceForm.amount}
                    placeholder="0,00"
                    onChange={(eventObject) => setInvoiceForm((current) => ({ ...current, amount: eventObject.target.value }))}
                  />
                </DetailField>

                <DetailField label="Data">
                  <input
                    className="form-input"
                    type="date"
                    value={invoiceForm.date}
                    onChange={(eventObject) => setInvoiceForm((current) => ({ ...current, date: eventObject.target.value }))}
                  />
                </DetailField>
              </div>

              <button type="button" className="page-action-bar__button page-action-bar__button--primary" onClick={handleInvoiceConfirm}>
                Confirmar faturamento
              </button>
            </div>
          ) : null}

          {innerMode === 'newReceivable' ? (
            <div className="calendar-detail__panel">
              <div className="calendar-detail__panel-header">
                <strong>Criar a receber</strong>
                <span>Use a atividade como origem para acompanhar o próximo recebimento.</span>
              </div>

              <div className="calendar-detail__form">
                <DetailField label="Valor a receber (R$)">
                  <input
                    className="form-input"
                    type="text"
                    value={receivableForm.amount}
                    placeholder="0,00"
                    onChange={(eventObject) => setReceivableForm((current) => ({ ...current, amount: eventObject.target.value }))}
                  />
                </DetailField>

                <DetailField label="Previsão de recebimento">
                  <input
                    className="form-input"
                    type="date"
                    value={receivableForm.dueDate}
                    onChange={(eventObject) => setReceivableForm((current) => ({ ...current, dueDate: eventObject.target.value }))}
                  />
                </DetailField>
              </div>

              <button type="button" className="page-action-bar__button page-action-bar__button--primary" onClick={handleReceivableConfirm}>
                Criar a receber
              </button>
            </div>
          ) : null}

          {innerMode === 'newTransaction' ? (
            <div className="calendar-detail__panel calendar-detail__panel--muted">
              <strong>Registro financeiro contextual</strong>
              <p>Abra o módulo de Finanças para registrar a transação vinculada a esta atividade com categoria e conta corretas.</p>
            </div>
          ) : null}

          {innerMode === 'newTask' ? (
            <div className="calendar-detail__panel">
              <div className="calendar-detail__panel-header">
                <strong>Criar tarefa de acompanhamento</strong>
                <span>Use uma tarefa curta quando o próximo passo exigir dono e prazo operacional.</span>
              </div>

              <div className="calendar-detail__form">
                <DetailField label="Título da tarefa">
                  <input
                    className="form-input"
                    type="text"
                    value={newTaskTitle}
                    placeholder="Ex.: Cobrar documento faltante"
                    onChange={(eventObject) => setNewTaskTitle(eventObject.target.value)}
                    onKeyDown={(eventObject) => {
                      if (eventObject.key === 'Enter') {
                        eventObject.preventDefault()
                        createQuickTask()
                      }
                    }}
                    autoFocus
                  />
                </DetailField>
              </div>

              <button type="button" className="page-action-bar__button page-action-bar__button--primary" onClick={createQuickTask}>
                Criar tarefa
              </button>
            </div>
          ) : null}

          {innerMode === 'editTask' ? (
            <div className="calendar-detail__panel calendar-detail__panel--muted">
              <strong>Edição principal</strong>
              <p>Use a tela de tarefas para alterar prioridade, responsável e demais campos estruturais com contexto completo.</p>
            </div>
          ) : null}

          {innerMode === 'editActivity' ? (
            <div className="calendar-detail__panel calendar-detail__panel--muted">
              <strong>Edição principal</strong>
              <p>Use a área de atividades para editar template, participantes e registros relacionados com mais contexto.</p>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
