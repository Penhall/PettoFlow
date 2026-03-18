// src/lib/financeUtils.test.js
import { describe, it, expect } from 'vitest'
import {
  shouldCreateReceivable,
  getPrincipalAccount,
  isWithin30Days,
  calculateFinanceTotals
} from './financeUtils'

describe('shouldCreateReceivable', () => {
  it('returns true when Vendas task has deal_value and no existing pending receivable', () => {
    const task = { id: 1, category: 'Vendas', deal_value: 10000 }
    const existing = []
    expect(shouldCreateReceivable(task, existing)).toBe(true)
  })

  it('returns false when a pending receivable already exists for the task', () => {
    const task = { id: 1, category: 'Vendas', deal_value: 10000 }
    const existing = [{ task_id: 1, status: 'pending' }]
    expect(shouldCreateReceivable(task, existing)).toBe(false)
  })

  it('returns false when deal_value is 0', () => {
    const task = { id: 1, category: 'Vendas', deal_value: 0 }
    expect(shouldCreateReceivable(task, [])).toBe(false)
  })

  it('returns false when deal_value is null', () => {
    const task = { id: 1, category: 'Vendas', deal_value: null }
    expect(shouldCreateReceivable(task, [])).toBe(false)
  })

  it('returns false when category is not Vendas', () => {
    const task = { id: 1, category: 'Operacional', deal_value: 10000 }
    expect(shouldCreateReceivable(task, [])).toBe(false)
  })

  it('returns true when only invoiced receivables exist (not pending)', () => {
    const task = { id: 1, category: 'Vendas', deal_value: 10000 }
    const existing = [{ task_id: 1, status: 'invoiced' }]
    expect(shouldCreateReceivable(task, existing)).toBe(true)
  })
})

describe('getPrincipalAccount', () => {
  it('returns the account with category principal', () => {
    const accounts = [
      { id: 1, category: 'extras', is_active: true },
      { id: 2, category: 'principal', is_active: true },
    ]
    expect(getPrincipalAccount(accounts)).toEqual(accounts[1])
  })

  it('returns null when no principal account exists', () => {
    const accounts = [{ id: 1, category: 'extras', is_active: true }]
    expect(getPrincipalAccount(accounts)).toBeNull()
  })

  it('ignores inactive accounts', () => {
    const accounts = [{ id: 1, category: 'principal', is_active: false }]
    expect(getPrincipalAccount(accounts)).toBeNull()
  })
})

describe('isWithin30Days', () => {
  it('returns true for today', () => {
    expect(isWithin30Days(new Date().toISOString())).toBe(true)
  })

  it('returns true for 29 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    expect(isWithin30Days(d.toISOString())).toBe(true)
  })

  it('returns false for 31 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 31)
    expect(isWithin30Days(d.toISOString())).toBe(false)
  })

  it('returns true for exactly 30 days ago (inclusive boundary)', () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    expect(isWithin30Days(d.toISOString())).toBe(true)
  })

  it('returns false for null', () => {
    expect(isWithin30Days(null)).toBe(false)
  })
})

describe('calculateFinanceTotals', () => {
  const accounts = [
    { id: 1, opening_balance: 100000, is_active: true, category: 'principal' },
    { id: 2, opening_balance: 50000,  is_active: true, category: 'reserva' },
  ]
  const transactions = [
    { account_id: 1, amount: 20000,  cleared: true },
    { account_id: 1, amount: -5000,  cleared: false }, // payable
    { account_id: 2, amount: 10000,  cleared: true },
  ]
  const receivables = [
    { amount: 30000, status: 'pending' },
    { amount: 15000, status: 'invoiced' }, // should not count
  ]

  it('calculates total balance from all active accounts + their cleared transactions', () => {
    const totals = calculateFinanceTotals(accounts, transactions, receivables)
    // account 1: 100000 + 20000 = 120000 (cleared only). account 2: 50000 + 10000 = 60000
    expect(totals.totalBalance).toBe(180000)
  })

  it('calculates principal balance separately', () => {
    const totals = calculateFinanceTotals(accounts, transactions, receivables)
    expect(totals.principalBalance).toBe(120000)
  })

  it('sums only pending receivables', () => {
    const totals = calculateFinanceTotals(accounts, transactions, receivables)
    expect(totals.totalReceivable).toBe(30000)
  })

  it('sums negative uncleared transactions as payable', () => {
    const totals = calculateFinanceTotals(accounts, transactions, receivables)
    expect(totals.totalPayable).toBe(5000) // absolute value
  })

  it('calculates projected balance', () => {
    const totals = calculateFinanceTotals(accounts, transactions, receivables)
    // 180000 + 30000 - 5000
    expect(totals.projectedBalance).toBe(205000)
  })

  it('ignores positive uncleared transactions in totalBalance (pending income excluded)', () => {
    const accts = [{ id: 1, opening_balance: 100000, is_active: true, category: 'extras' }]
    const txs = [{ account_id: 1, amount: 50000, cleared: false }] // positive but uncleared
    const totals = calculateFinanceTotals(accts, txs, [])
    expect(totals.totalBalance).toBe(100000) // uncleared income not included
  })
})
