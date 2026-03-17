// src/components/Finance/TransactionList.jsx
import { AlertTriangle, Edit2, Trash2, CheckCircle } from 'lucide-react'
import { centsToReal } from '../../lib/finUtils'

const TransactionList = ({
  transactions,
  accounts,
  payees,
  categories,
  onEdit,
  onDelete,
  onApplyRules,
  loading,
}) => {
  const needsReviewCount = transactions.filter(t => t.needs_review).length
  const getAccountName  = (id) => accounts.find(a => a.id === id)?.name || '—'
  const getPayeeName    = (id) => payees.find(p => p.id === id)?.name   || '—'
  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '—'

  if (loading) return <p className="loading-text">Carregando transações...</p>

  return (
    <div className="transaction-list">
      {needsReviewCount > 0 && (
        <div className="review-banner">
          <AlertTriangle size={16} />
          <span>
            {needsReviewCount} transaç{needsReviewCount === 1 ? 'ão precisa' : 'ões precisam'} de revisão
          </span>
          <button className="action-btn sm" onClick={onApplyRules}>Aplicar Regras</button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state"><p>Nenhuma transação encontrada.</p></div>
      ) : (
        <table className="tx-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pagador</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th className="tx-amount-col">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className={tx.needs_review ? 'needs-review' : ''}>
                <td className="tx-date">
                  {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </td>
                <td className="tx-payee">
                  {getPayeeName(tx.payee_id)}
                  {tx.needs_review && <AlertTriangle size={12} className="review-icon" title="Aguardando revisão" />}
                </td>
                <td className="tx-category">{getCategoryName(tx.category_id)}</td>
                <td className="tx-account">{getAccountName(tx.account_id)}</td>
                <td className={`tx-amount ${tx.amount < 0 ? 'expense' : 'income'}`}>
                  {centsToReal(tx.amount)}
                </td>
                <td className="tx-actions">
                  {tx.cleared && <CheckCircle size={14} className="cleared-icon" title="Conciliado" />}
                  <button className="icon-btn sm" onClick={() => onEdit(tx)} title="Editar"><Edit2 size={14} /></button>
                  <button className="icon-btn sm danger" onClick={() => onDelete(tx.id)} title="Excluir"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default TransactionList
