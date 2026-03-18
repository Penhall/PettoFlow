// src/lib/financeUtils.js

/**
 * Returns true if a receivable should be auto-created for a completed Vendas task.
 */
export function shouldCreateReceivable(task, existingReceivables = []) {
  if (task.category !== 'Vendas') return false
  if (!task.deal_value || task.deal_value <= 0) return false
  const hasPending = existingReceivables.some(
    r => r.task_id === task.id && r.status === 'pending'
  )
  return !hasPending
}

/**
 * Returns the active account with category === 'principal', or null.
 */
export function getPrincipalAccount(accounts = []) {
  return accounts.find(a => a.category === 'principal' && a.is_active !== false) ?? null
}

/**
 * Returns true if dateStr is within the last 30 days.
 */
export function isWithin30Days(dateStr) {
  if (!dateStr) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return new Date(dateStr) >= cutoff
}

/**
 * Calculates all Finance panel totals from raw data.
 * All amounts are in cents.
 */
export function calculateFinanceTotals(accounts = [], transactions = [], receivables = []) {
  const activeAccounts = accounts.filter(a => a.is_active !== false)

  const balanceByAccount = {}
  for (const acc of activeAccounts) {
    balanceByAccount[acc.id] = acc.opening_balance ?? 0
  }
  for (const tx of transactions) {
    if (tx.cleared && balanceByAccount[tx.account_id] !== undefined) {
      balanceByAccount[tx.account_id] += tx.amount
    }
  }

  const totalBalance = Object.values(balanceByAccount).reduce((s, v) => s + v, 0)

  const principal = getPrincipalAccount(activeAccounts)
  const principalBalance = principal ? (balanceByAccount[principal.id] ?? 0) : 0

  const totalReceivable = receivables
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0)

  const totalPayable = transactions
    .filter(t => t.amount < 0 && t.cleared === false)
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  const projectedBalance = totalBalance + totalReceivable - totalPayable

  return { totalBalance, principalBalance, totalReceivable, totalPayable, projectedBalance }
}
