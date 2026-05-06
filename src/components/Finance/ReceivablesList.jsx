// src/components/Finance/ReceivablesList.jsx
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { centsToReal, realToCents } from '../../lib/finUtils'
import EmptyState from '../shared/EmptyState.jsx'

export default function ReceivablesList({ receivables, onInvoice, addActivity, onAddTask, columns = [] }) {
  const [invoicingId, setInvoicingId] = useState(null)
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', date: '' })

  const openInvoice = (receivable) => {
    setInvoicingId(receivable.id)
    setInvoiceForm({
      amount: (receivable.amount / 100).toFixed(2).replace('.', ','),
      date: new Date().toISOString().slice(0, 10),
    })
  }

  const handleConfirm = async () => {
    const amountCents = realToCents(invoiceForm.amount)
    if (!amountCents || amountCents <= 0) return
    if (!invoiceForm.date) return
    await onInvoice(invoicingId, amountCents, invoiceForm.date)
    setInvoicingId(null)
    setInvoiceForm({ amount: '', date: '' })
  }

  if (receivables.length === 0) {
    return (
      <EmptyState
        title="Nenhum valor a receber"
        description="Esta área concentra recebíveis pendentes, faturamento e próximos movimentos operacionais."
        detail="O painel está vazio porque não existem valores pendentes no momento."
      />
    )
  }

  return (
    <div className="receivables-list">
      {receivables.map((receivable) => (
        <div
          key={receivable.id}
          className="receivable-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 0',
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 500 }}>
              {receivable.tasks?.title ?? receivable.activities?.title ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {receivable.accounts?.name ?? '—'} · {new Date(receivable.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>

          <span style={{ fontWeight: 600, color: 'var(--accent-green, #05CD99)' }}>
            {centsToReal(receivable.amount)}
          </span>

          {invoicingId === receivable.id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                style={{ width: 110 }}
                placeholder="Valor"
              />
              <input
                type="date"
                className="form-input"
                value={invoiceForm.date}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, date: event.target.value }))}
              />
              <button className="btn-primary" onClick={handleConfirm}>
                Confirmar
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setInvoicingId(null) }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <button
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => openInvoice(receivable)}
              >
                <CheckCircle size={14} /> Faturar
              </button>

              <button
                className="action-btn"
                style={{ fontSize: 13, padding: '4px 10px' }}
                onClick={() => addActivity?.({
                  title: `Follow-up: ${receivable.tasks?.title ?? receivable.activities?.title ?? ''}`,
                  type: 'call',
                  status: 'pending',
                  scheduled_at: null,
                  related_to: [{ type: 'receivable', id: receivable.id }],
                })}
              >
                Follow-up
              </button>

              <button
                className="action-btn"
                style={{ fontSize: 13, padding: '4px 10px' }}
                onClick={() => onAddTask?.({
                  title: `Cobrar: ${receivable.tasks?.title ?? receivable.activities?.title ?? ''}`,
                  status: columns[0]?.name ?? 'A Fazer',
                  priority: 'Média',
                })}
              >
                Nova tarefa
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
