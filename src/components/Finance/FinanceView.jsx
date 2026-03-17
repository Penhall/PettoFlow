// src/components/Finance/FinanceView.jsx
import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Wallet } from 'lucide-react'
import { useAccounts }       from '../../hooks/useAccounts'
import { usePayees }         from '../../hooks/usePayees'
import { useFinCategories }  from '../../hooks/useFinCategories'
import { useFinRules }       from '../../hooks/useFinRules'
import { useTransactions }   from '../../hooks/useTransactions'
import AccountCard     from './AccountCard'
import AccountForm     from './AccountForm'
import TransactionList from './TransactionList'
import TransactionForm from './TransactionForm'
import RuleBuilder     from './RuleBuilder'

const FinanceView = ({ clients = [], tasks = [], team = [] }) => {
  const [activeTab, setActiveTab] = useState('extrato')
  const [extractoFilters, setExtractoFilters] = useState({})
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editingTransaction, setEditingTransaction]   = useState(null)
  const [showAccountForm, setShowAccountForm]         = useState(false)
  const [editingAccount, setEditingAccount]           = useState(null)
  const [editingRule, setEditingRule]                 = useState(null) // rule | 'new' | null

  const { accounts, addAccount, updateAccount }             = useAccounts()
  const { payees, addPayee }                                = usePayees()
  const { groups, categories }                              = useFinCategories()
  const { rules, addRule, updateRule, deleteRule }          = useFinRules()

  // Estratégia de filtros:
  // - Contas/Regras: effectiveFilters = {} → carrega TODAS as transações → balances corretos
  // - Extrato: effectiveFilters = extractoFilters → display filtrado
  // O balance só é exibido na aba Contas (quando filters = {}), portanto nunca fica incorreto.
  const effectiveFilters = activeTab === 'extrato' ? extractoFilters : {}
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction, applyRules }
    = useTransactions(effectiveFilters, rules)

  const balances = useMemo(() => {
    const map = {}
    accounts.forEach(acc => {
      map[acc.id] = acc.opening_balance +
        transactions
          .filter(t => t.account_id === acc.id)
          .reduce((sum, t) => sum + t.amount, 0)
    })
    return map
  }, [accounts, transactions])

  const handleSaveTransaction = async (form) => {
    if (editingTransaction) await updateTransaction(editingTransaction.id, form)
    else await addTransaction(form)
    setShowTransactionForm(false)
    setEditingTransaction(null)
  }

  const handleSaveAccount = async (form) => {
    if (editingAccount) await updateAccount(editingAccount.id, form)
    else await addAccount(form)
    setShowAccountForm(false)
    setEditingAccount(null)
  }

  const handleSaveRule = async (form) => {
    if (editingRule && editingRule !== 'new') await updateRule(editingRule.id, form)
    else await addRule(form)
    setEditingRule(null)
  }

  const activeAccounts = accounts.filter(a => a.is_active)
  const tabs = ['extrato', 'contas', 'regras']

  return (
    <div className="finance-view">
      <div className="view-header">
        <h3>Finanças</h3>
        <div className="view-controls">
          <div className="tabs">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="actions">
            {activeTab === 'extrato' && (
              <button
                className="add-member-btn"
                onClick={() => { setEditingTransaction(null); setShowTransactionForm(true) }}
              >
                <Plus size={16} /> Nova Transação
              </button>
            )}
            {activeTab === 'contas' && (
              <button
                className="add-member-btn"
                onClick={() => { setEditingAccount(null); setShowAccountForm(true) }}
              >
                <Plus size={16} /> Nova Conta
              </button>
            )}
            {activeTab === 'regras' && (
              <button className="add-member-btn" onClick={() => setEditingRule('new')}>
                <Plus size={16} /> Nova Regra
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="board-container">
        {/* TAB: Extrato */}
        {activeTab === 'extrato' && (
          <>
            {/* Filtros por conta / período / categoria — spec linha 314 */}
            <div className="finance-filters">
              <select
                value={extractoFilters.accountId ?? ''}
                onChange={e => setExtractoFilters(f => ({
                  ...f, accountId: e.target.value ? Number(e.target.value) : undefined
                }))}
              >
                <option value="">Todas as contas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input
                type="date"
                value={extractoFilters.dateFrom ?? ''}
                onChange={e => setExtractoFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
                placeholder="De"
              />
              <input
                type="date"
                value={extractoFilters.dateTo ?? ''}
                onChange={e => setExtractoFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
                placeholder="Até"
              />
              <select
                value={extractoFilters.categoryId ?? ''}
                onChange={e => setExtractoFilters(f => ({
                  ...f, categoryId: e.target.value ? Number(e.target.value) : undefined
                }))}
              >
                <option value="">Todas as categorias</option>
                {categories.filter(c => !c.hidden).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {Object.values(extractoFilters).some(Boolean) && (
                <button className="action-btn sm" onClick={() => setExtractoFilters({})}>
                  Limpar filtros
                </button>
              )}
            </div>
            <TransactionList
              transactions={transactions}
              accounts={accounts}
              payees={payees}
              categories={categories}
              onEdit={(tx) => { setEditingTransaction(tx); setShowTransactionForm(true) }}
              onDelete={deleteTransaction}
              onApplyRules={applyRules}
              loading={txLoading}
            />
          </>
        )}

        {/* TAB: Contas */}
        {activeTab === 'contas' && (
          <div className="accounts-grid">
            {activeAccounts.length === 0 ? (
              <div className="empty-state">
                <Wallet size={28} />
                <p>Nenhuma conta. Clique em &quot;Nova Conta&quot; para começar.</p>
              </div>
            ) : (
              activeAccounts.map(acc => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  balance={balances[acc.id] ?? acc.opening_balance}
                  onClick={() => { setEditingAccount(acc); setShowAccountForm(true) }}
                />
              ))
            )}
          </div>
        )}

        {/* TAB: Regras */}
        {activeTab === 'regras' && (
          <div className="rules-list">
            {editingRule === 'new' && (
              <div className="rule-item editing">
                <RuleBuilder rule={null} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
              </div>
            )}
            {rules.length === 0 && editingRule !== 'new' && (
              <div className="empty-state">
                <p>Nenhuma regra. Regras automatizam a categorização das transações.</p>
              </div>
            )}
            {rules.map(rule => (
              <div key={rule.id} className={`rule-item ${editingRule?.id === rule.id ? 'editing' : ''}`}>
                {editingRule?.id === rule.id ? (
                  <RuleBuilder
                    rule={rule}
                    onSave={handleSaveRule}
                    onCancel={() => setEditingRule(null)}
                  />
                ) : (
                  <div className="rule-summary">
                    <div className="rule-info">
                      <span className="rule-name">{rule.name}</span>
                      <span className={`rule-status ${rule.is_active ? 'active' : 'inactive'}`}>
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className="rule-priority">Prioridade {rule.priority}</span>
                      <span className="rule-meta">
                        {rule.conditions.length} condição(ões) · {rule.actions.length} ação(ões)
                      </span>
                    </div>
                    <div className="rule-actions">
                      <button className="action-btn sm" onClick={() => setEditingRule(rule)}>Editar</button>
                      <button className="action-btn sm danger" onClick={() => deleteRule(rule.id)}>Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      <AnimatePresence>
        {showTransactionForm && (
          <TransactionForm
            transaction={editingTransaction}
            accounts={accounts}
            payees={payees}
            groups={groups}
            categories={categories}
            clients={clients}
            tasks={tasks}
            team={team}
            onSave={handleSaveTransaction}
            onClose={() => { setShowTransactionForm(false); setEditingTransaction(null) }}
            addPayee={addPayee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountForm && (
          <AccountForm
            account={editingAccount}
            onSave={handleSaveAccount}
            onClose={() => { setShowAccountForm(false); setEditingAccount(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default FinanceView
