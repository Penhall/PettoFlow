// src/components/Finance/AccountCard.jsx
import { Wallet, CreditCard, PiggyBank, Banknote } from 'lucide-react'
import { centsToReal } from '../../lib/finUtils'

const TYPE_ICONS = { checking: Banknote, savings: PiggyBank, credit: CreditCard, cash: Wallet }
const TYPE_LABELS = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit: 'Cartão de Crédito',
  cash: 'Dinheiro',
}

const CATEGORY_STYLE = {
  principal: { label: 'Principal', bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
  reserva:   { label: 'Reserva',   bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  extras:    { label: 'Extras',    bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
}

const AccountCard = ({ account, balance, onClick }) => {
  const Icon = TYPE_ICONS[account.type] || Wallet
  const isNegative = balance < 0
  return (
    <div className={`account-card ${isNegative ? 'negative' : ''}`} onClick={onClick}>
      <div className="account-card-header">
        <Icon size={20} className="account-icon" />
        <span className="account-type-badge">{TYPE_LABELS[account.type] || account.type}</span>
        {account.category && account.category !== 'extras' && (
          <span style={{
            display: 'inline-block',
            background: (CATEGORY_STYLE[account.category] ?? { bg: '#f3f4f6' }).bg,
            color: (CATEGORY_STYLE[account.category] ?? { color: '#6b7280' }).color,
            border: `1px solid ${(CATEGORY_STYLE[account.category] ?? { border: '#e5e7eb' }).border}`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 6,
          }}>
            {(CATEGORY_STYLE[account.category] ?? { label: account.category }).label}
          </span>
        )}
      </div>
      <div className="account-name">{account.name}</div>
      <div className={`account-balance ${isNegative ? 'negative' : 'positive'}`}>
        {centsToReal(balance)}
      </div>
    </div>
  )
}

export default AccountCard
