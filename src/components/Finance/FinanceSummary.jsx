// src/components/Finance/FinanceSummary.jsx
import { Wallet, Star, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { calculateFinanceTotals } from '../../lib/financeUtils'
import { centsToReal } from '../../lib/finUtils'

export default function FinanceSummary({ accounts, transactions, receivables, onClickReceivable, onClickPayable }) {
  const totals = calculateFinanceTotals(accounts, transactions, receivables)

  const cards = [
    {
      label: 'Saldo Total',
      value: totals.totalBalance,
      icon: <Wallet size={18} />,
      color: '#7C3AED',
    },
    {
      label: 'Conta Principal',
      value: totals.principalBalance,
      icon: <Star size={18} />,
      color: '#f59e0b',
    },
    {
      label: 'A Receber',
      value: totals.totalReceivable,
      icon: <TrendingUp size={18} />,
      color: '#05CD99',
      onClick: onClickReceivable,
    },
    {
      label: 'A Pagar',
      value: totals.totalPayable,
      icon: <TrendingDown size={18} />,
      color: '#EE5D50',
      onClick: onClickPayable,
    },
    {
      label: 'Saldo Previsto',
      value: totals.projectedBalance,
      icon: <Eye size={18} />,
      color: totals.projectedBalance >= 0 ? '#05CD99' : '#EE5D50',
    },
  ]

  return (
    <div className="finance-summary" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {cards.map(card => (
        <div
          key={card.label}
          className="stat-card"
          style={{
            flex: '1 1 150px',
            minWidth: 130,
            cursor: card.onClick ? 'pointer' : 'default',
          }}
          onClick={card.onClick}
          title={card.onClick ? 'Clique para filtrar' : undefined}
        >
          <div className="stat-icon" style={{ color: card.color }}>
            {card.icon}
          </div>
          <div>
            <div className="stat-label">{card.label}</div>
            <div
              className="stat-value"
              style={{ color: card.value < 0 ? '#EE5D50' : 'inherit', fontSize: 15 }}
            >
              {centsToReal(card.value)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
