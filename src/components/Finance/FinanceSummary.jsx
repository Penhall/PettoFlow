// src/components/Finance/FinanceSummary.jsx
import { Wallet, Star, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { calculateFinanceTotals } from '../../lib/financeUtils'
import { centsToReal } from '../../lib/finUtils'
import MetricCard from '../shared/MetricCard.jsx'

export default function FinanceSummary({ accounts, transactions, receivables, onClickReceivable, onClickPayable }) {
  const totals = calculateFinanceTotals(accounts, transactions, receivables)

  const cards = [
    {
      label: 'Saldo Total',
      value: totals.totalBalance,
      icon: Wallet,
      meta: 'Base consolidada',
    },
    {
      label: 'Conta Principal',
      value: totals.principalBalance,
      icon: Star,
      meta: 'Conta operacional',
    },
    {
      label: 'A Receber',
      value: totals.totalReceivable,
      icon: TrendingUp,
      meta: 'Fluxo previsto',
      onClick: onClickReceivable,
    },
    {
      label: 'A Pagar',
      value: totals.totalPayable,
      icon: TrendingDown,
      meta: 'Saidas pendentes',
      onClick: onClickPayable,
    },
    {
      label: 'Saldo Previsto',
      value: totals.projectedBalance,
      icon: Eye,
      meta: 'Cenario liquido',
    },
  ]

  return (
    <div className="finance-summary-grid">
      {cards.map(card => (
        <button
          key={card.label}
          type="button"
          className={`finance-summary-card ${card.onClick ? 'is-clickable' : ''}`}
          onClick={card.onClick}
          disabled={!card.onClick}
          title={card.onClick ? 'Clique para filtrar' : undefined}
        >
          <MetricCard
            label={card.label}
            value={centsToReal(card.value)}
            meta={card.meta}
            icon={card.icon}
            compact
            className={card.value < 0 ? 'finance-summary-card__metric is-negative' : 'finance-summary-card__metric'}
          />
        </button>
      ))}
    </div>
  )
}
