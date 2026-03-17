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

const AccountCard = ({ account, balance, onClick }) => {
  const Icon = TYPE_ICONS[account.type] || Wallet
  const isNegative = balance < 0
  return (
    <div className={`account-card ${isNegative ? 'negative' : ''}`} onClick={onClick}>
      <div className="account-card-header">
        <Icon size={20} className="account-icon" />
        <span className="account-type-badge">{TYPE_LABELS[account.type] || account.type}</span>
      </div>
      <div className="account-name">{account.name}</div>
      <div className={`account-balance ${isNegative ? 'negative' : 'positive'}`}>
        {centsToReal(balance)}
      </div>
    </div>
  )
}

export default AccountCard
