import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAccounts } from '../../hooks/useAccounts'
import { usePayees } from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import { useFinRules } from '../../hooks/useFinRules'
import { useTransactions } from '../../hooks/useTransactions'
import { useReceivables } from '../../hooks/useReceivables'
import { useActivities } from '../../hooks/useActivities'
import { useTenant } from '../../hooks/useTenant.js'
import AccountCard from './AccountCard'
import AccountForm from './AccountForm'
import TransactionList from './TransactionList'
import TransactionForm from './TransactionForm'
import RuleBuilder from './RuleBuilder'
import ReceivablesList from './ReceivablesList'
import FinanceSummary from './FinanceSummary'
import CalendarView from '../Calendar/CalendarView'
import ContextualHint from '../onboarding/ContextualHint.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'
import EmptyState from '../shared/EmptyState.jsx'
import { calculateFinanceTotals } from '../../lib/financeUtils'
import { centsToReal } from '../../lib/finUtils'
import { isEnabled } from '../../lib/featureFlags.js'
import { isMutationOk, getMutationMessage, getMutationData } from '../../lib/mutationResult.js'

const FINANCE_TABS = [
  { id: 'extrato', label: 'Extrato' },
  { id: 'contas', label: 'Contas' },
  { id: 'regras', label: 'Regras' },
  { id: 'receber', label: 'A receber' },
  { id: 'calendario', label: 'Calendário' },
]

const FinanceView = ({
  clients = [],
  tasks = [],
  team = [],
  onAddTask,
  columns = [],
  onOpenTutorial = () => {},
  onTrackOnboarding = () => {},
  showFiltersHint = false,
  onDismissFiltersHint = () => {},
}) => {
  const { activeTenantId } = useTenant()
  const [activeTab, setActiveTab] = useState('extrato')
  const [extractoFilters, setExtractoFilters] = useState({})
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [calendarClickDate, setCalendarClickDate] = useState(null)
  const [formError, setFormError] = useState('')

  const { addActivity } = useActivities({ tenantId: activeTenantId })
  const { accounts, addAccount, updateAccount, getPrincipalAccount, getUniqueCategories, setAccountCategory, readResult: accountsRead } = useAccounts({ tenantId: activeTenantId })
  const { payees, addPayee, readResult: payeesRead } = usePayees({ tenantId: activeTenantId })
  const { groups, categories, readResult: categoriesRead } = useFinCategories({ tenantId: activeTenantId })
  const { rules, addRule, updateRule, deleteRule, readResult: rulesRead } = useFinRules({ tenantId: activeTenantId })
  const { listReceivables, invoiceReceivable, refresh: refreshReceivables, receivables, readResult: receivablesRead } = useReceivables({ tenantId: activeTenantId })

  const effectiveFilters = activeTab === 'extrato' ? extractoFilters : {}
  const {
    transactions,
    loading: txLoading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    applyRules,
    readResult: transactionsRead,
  } = useTransactions({ filters: effectiveFilters, rules, tenantId: activeTenantId })

  const { transactions: allTransactions, readResult: allTransactionsRead } = useTransactions({ filters: {}, rules, tenantId: activeTenantId })
  const degradedReads = [accountsRead, payeesRead, categoriesRead, rulesRead, receivablesRead, transactionsRead, allTransactionsRead]
    .filter((result) => result?.error || result?.stale)

  const balances = useMemo(() => {
    const map = {}
    accounts.forEach((account) => {
      map[account.id] = account.opening_balance +
        transactions
          .filter((transaction) => transaction.account_id === account.id)
          .reduce((sum, transaction) => sum + transaction.amount, 0)
    })
    return map
  }, [accounts, transactions])

  const activeAccounts = accounts.filter((account) => account.is_active)
  const pendingReceivables = listReceivables({ status: 'pending' })
  const totals = useMemo(
    () => calculateFinanceTotals(accounts, allTransactions, receivables),
    [accounts, allTransactions, receivables]
  )

  const tabItems = FINANCE_TABS.map((tab) => {
    if (tab.id === 'contas') return { ...tab, count: activeAccounts.length }
    if (tab.id === 'regras') return { ...tab, count: rules.length }
    if (tab.id === 'receber') return { ...tab, count: pendingReceivables.length }
    return tab
  })

  const handleSaveTransaction = async (form) => {
    setFormError('')
    const result = editingTransaction
      ? await updateTransaction(editingTransaction.id, form)
      : await addTransaction(form)
    if (!isMutationOk(result)) {
      setFormError(getMutationMessage(result))
      return result
    }
    setShowTransactionForm(false)
    setEditingTransaction(null)
    setCalendarClickDate(null)
    return result
  }

  const handleSaveAccount = async (formData, demotedCategory) => {
    const { category, ...rest } = formData
    setFormError('')
    let result
    if (editingAccount) {
      if (category !== editingAccount.category) {
        result = await updateAccount(editingAccount.id, rest)
        if (!isMutationOk(result)) return result
        result = await setAccountCategory(editingAccount.id, category, demotedCategory)
      } else {
        result = await updateAccount(editingAccount.id, { ...rest, category })
      }
    } else {
      result = await addAccount({ ...rest, category: 'extras' })
      if (!isMutationOk(result)) {
        setFormError(getMutationMessage(result))
        return result
      }
      const saved = getMutationData(result)
      if (saved && category !== 'extras') {
        result = await setAccountCategory(saved.id, category, demotedCategory)
      }
    }
    if (!isMutationOk(result)) {
      setFormError(getMutationMessage(result))
      return result
    }
    setShowAccountForm(false)
    setEditingAccount(null)
    return result
  }

  const handleSaveRule = async (form) => {
    setFormError('')
    const result = editingRule && editingRule !== 'new'
      ? await updateRule(editingRule.id, form)
      : await addRule(form)
    if (!isMutationOk(result)) {
      setFormError(getMutationMessage(result))
      return result
    }
    setEditingRule(null)
    return result
  }

  const primaryAction = activeTab === 'extrato'
    ? { label: 'Nova transação', onClick: () => { setEditingTransaction(null); setShowTransactionForm(true) } }
    : activeTab === 'contas'
      ? { label: 'Nova conta', onClick: () => { setEditingAccount(null); setShowAccountForm(true) } }
      : activeTab === 'regras'
        ? { label: 'Nova regra', onClick: () => setEditingRule('new') }
        : null

  const actionMeta = activeTab === 'extrato'
    ? `${transactions.length} ${transactions.length === 1 ? 'transação' : 'transações'}`
    : activeTab === 'contas'
      ? `${activeAccounts.length} ${activeAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}`
      : activeTab === 'regras'
        ? `${rules.length} ${rules.length === 1 ? 'regra' : 'regras'}`
        : activeTab === 'receber'
          ? `${pendingReceivables.length} ${pendingReceivables.length === 1 ? 'pendência' : 'pendências'}`
          : null

  const renderFinanceContent = () => {
    if (activeTab === 'extrato') {
      return (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          payees={payees}
          categories={categories}
          onEdit={(transaction) => { setEditingTransaction(transaction); setShowTransactionForm(true) }}
          onDelete={deleteTransaction}
          onApplyRules={applyRules}
          loading={txLoading}
          readResult={transactionsRead}
        />
      )
    }

    if (activeTab === 'contas') {
      return (
        <div className="accounts-grid">
          {activeAccounts.length === 0 ? (
            <EmptyState
              title="Nenhuma conta ativa"
              description="As contas organizam saldo, conciliação e fluxo por origem financeira."
              detail="Crie a primeira conta para começar a registrar transações e acompanhar o caixa."
              quickActions={[
                {
                  id: 'create-account',
                  label: 'Criar conta',
                  onClick: () => {
                    onTrackOnboarding('quick_action_triggered', {
                      surface: 'finance.accounts',
                      actionId: 'create-account',
                    })
                    setEditingAccount(null)
                    setShowAccountForm(true)
                  },
                },
              ]}
              tutorialAction={{
                label: 'Abrir tutorial',
                onClick: () => {
                  onTrackOnboarding('empty_state_cta_clicked', {
                    surface: 'finance.accounts',
                    actionId: 'tutorial',
                  })
                  onOpenTutorial()
                },
              }}
            />
          ) : (
            activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={balances[account.id] ?? account.opening_balance}
                onClick={() => { setEditingAccount(account); setShowAccountForm(true) }}
              />
            ))
          )}
        </div>
      )
    }

    if (activeTab === 'regras') {
      return (
        <div className="rules-list">
          {editingRule === 'new' && (
            <div className="rule-item editing">
              <RuleBuilder rule={null} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
            </div>
          )}
          {rules.length === 0 && editingRule !== 'new' && (
            <EmptyState
              title="Nenhuma regra criada"
              description="As regras automatizam classificação e reduzem trabalho manual no extrato."
              detail="Esta área está vazia porque nenhuma automação financeira foi configurada ainda."
              quickActions={[
                {
                  id: 'create-rule',
                  label: 'Criar regra',
                  onClick: () => {
                    onTrackOnboarding('quick_action_triggered', {
                      surface: 'finance.rules',
                      actionId: 'create-rule',
                    })
                    setEditingRule('new')
                  },
                },
              ]}
              tutorialAction={{
                label: 'Abrir tutorial',
                onClick: () => {
                  onTrackOnboarding('empty_state_cta_clicked', {
                    surface: 'finance.rules',
                    actionId: 'tutorial',
                  })
                  onOpenTutorial()
                },
              }}
            />
          )}
          {rules.map((rule) => (
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
      )
    }

    if (activeTab === 'receber') {
      return (
        <ReceivablesList
          receivables={pendingReceivables}
          onInvoice={async (id, amount, date) => {
            const result = await invoiceReceivable(id, amount, date, addTransaction)
            if (!isMutationOk(result)) {
              setFormError(getMutationMessage(result))
              if (result.code?.startsWith('partial_') && isEnabled('partial_failure_warning')) {
                setFormError('Faturamento foi criado parcialmente. Verifique se a transação foi registrada corretamente e tente novamente.')
              }
              return result
            }
            refreshReceivables()
            return result
          }}
          addActivity={addActivity}
          onAddTask={onAddTask}
          columns={columns}
        />
      )
    }

    return (
      <CalendarView
        filterTypes={['receivable', 'transaction']}
        contextArea="financas"
        clients={clients}
        tasks={tasks}
        team={team}
        columns={columns}
        onAddTask={onAddTask}
        onEmptyDateClick={(dateStr) => {
          setEditingTransaction(null)
          setCalendarClickDate(dateStr)
          setShowTransactionForm(true)
        }}
      />
    )
  }

  return (
    <div className="finance-page">
      <PageHeader
        eyebrow="Operação"
        title="Finanças"
        subtitle="Acompanhe extrato, contas, regras e previsões com leitura operacional compacta."
        metrics={[
          { label: 'Saldo consolidado', value: centsToReal(totals.totalBalance) },
          { label: 'A receber', value: centsToReal(totals.totalReceivable) },
          { label: 'Saldo previsto', value: centsToReal(totals.projectedBalance) },
        ]}
      />

      <FinanceSummary
        accounts={accounts}
        transactions={allTransactions}
        receivables={receivables}
        onClickReceivable={() => setActiveTab('receber')}
        onClickPayable={() => {
          setActiveTab('extrato')
          setExtractoFilters({ cleared: false, onlyNegative: true })
        }}
      />

      <PageTabs
        items={tabItems}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Áreas de finanças"
      />

      <PageActionBar
        primaryAction={primaryAction}
        meta={actionMeta}
      >
        {activeTab === 'extrato' ? (
          <div className="finance-filters">
            <select
              value={extractoFilters.accountId ?? ''}
              onChange={(event) => setExtractoFilters((current) => ({
                ...current,
                accountId: event.target.value ? Number(event.target.value) : undefined,
              }))}
            >
              <option value="">Todas as contas</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <input
              type="date"
              value={extractoFilters.dateFrom ?? ''}
              onChange={(event) => setExtractoFilters((current) => ({ ...current, dateFrom: event.target.value || undefined }))}
              placeholder="De"
            />
            <input
              type="date"
              value={extractoFilters.dateTo ?? ''}
              onChange={(event) => setExtractoFilters((current) => ({ ...current, dateTo: event.target.value || undefined }))}
              placeholder="Até"
            />
            <select
              value={extractoFilters.categoryId ?? ''}
              onChange={(event) => setExtractoFilters((current) => ({
                ...current,
                categoryId: event.target.value ? Number(event.target.value) : undefined,
              }))}
            >
              <option value="">Todas as categorias</option>
              {categories.filter((category) => !category.hidden).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {Object.keys(extractoFilters).length > 0 ? (
              <button className="page-action-bar__button" onClick={() => setExtractoFilters({})}>
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}
      </PageActionBar>

      {activeTab === 'extrato' && showFiltersHint ? (
        <ContextualHint
          title="Comece lendo a assinatura recorrente e a conta principal"
          description="Os filtros ajudam a separar caixa, categorias e períodos sem perder densidade operacional."
          actionLabel="Abrir tutorial"
          onAction={() => {
            onTrackOnboarding('empty_state_cta_clicked', {
              surface: 'finance.filters-hint',
              actionId: 'tutorial',
            })
            onOpenTutorial()
          }}
          onDismiss={onDismissFiltersHint}
        />
      ) : null}

      <SurfaceCard className="finance-page__surface" padded={activeTab !== 'extrato'}>
        {formError ? (
          <p style={{ color: 'var(--error, #ef4444)', fontSize: 13, margin: '0 0 12px' }}>{formError}</p>
        ) : null}
        {degradedReads.length > 0 ? (
          <p style={{ color: 'var(--warning, #f59e0b)', fontSize: 13, margin: '0 0 12px' }}>
            {degradedReads.some((result) => result.stale)
              ? 'Alguns dados financeiros estão anteriores à última tentativa de atualização.'
              : degradedReads[0].error?.message}
          </p>
        ) : null}
        {renderFinanceContent()}
      </SurfaceCard>

      <AnimatePresence>
        {showTransactionForm && (
          <TransactionForm
            transaction={editingTransaction}
            initialDate={editingTransaction ? undefined : calendarClickDate}
            accounts={accounts}
            payees={payees}
            groups={groups}
            categories={categories}
            clients={clients}
            tasks={tasks}
            team={team}
            onSave={handleSaveTransaction}
            onClose={() => {
              setShowTransactionForm(false)
              setEditingTransaction(null)
              setCalendarClickDate(null)
            }}
            addPayee={addPayee}
            addActivity={addActivity}
            onCreateTask={onAddTask}
            onUpdateTransaction={updateTransaction}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountForm && (
          <AccountForm
            account={editingAccount}
            onSave={handleSaveAccount}
            onClose={() => { setShowAccountForm(false); setEditingAccount(null) }}
            categories={getUniqueCategories()}
            existingPrincipal={getPrincipalAccount()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default FinanceView
