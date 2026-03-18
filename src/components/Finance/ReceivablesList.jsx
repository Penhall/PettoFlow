// src/components/Finance/ReceivablesList.jsx
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { centsToReal, realToCents } from '../../lib/finUtils'

export default function ReceivablesList({ receivables, onInvoice }) {
  const [invoicingId, setInvoicingId] = useState(null)
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', date: '' })

  const openInvoice = (r) => {
    setInvoicingId(r.id)
    setInvoiceForm({
      amount: (r.amount / 100).toFixed(2).replace('.', ','),
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
      <p style={{ color: 'var(--text-secondary)', padding: '24px 0' }}>
        Nenhum valor a receber pendente.
      </p>
    )
  }

  return (
    <div className="receivables-list">
      {receivables.map(r => (
        <div key={r.id} className="receivable-row" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 500 }}>{r.tasks?.title ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {r.accounts?.name ?? '—'} · {new Date(r.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>

          <span style={{ fontWeight: 600, color: 'var(--accent-green, #05CD99)' }}>
            {centsToReal(r.amount)}
          </span>

          {invoicingId === r.id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                value={invoiceForm.amount}
                onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                style={{ width: 110 }}
                placeholder="Valor"
              />
              <input
                type="date"
                className="form-input"
                value={invoiceForm.date}
                onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))}
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
            <button
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => openInvoice(r)}
            >
              <CheckCircle size={14} /> Faturar
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
