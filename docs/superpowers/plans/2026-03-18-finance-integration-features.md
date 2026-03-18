# Finance Integration & Productivity Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sales-task-to-finance integration, account categorization, activity templates, a finance summary panel, and task archiving to PettoFlow.

**Architecture:** Features 1/2/4 (finance) are tightly coupled and built first; Features 3/5 (productivity) are independent and built last. All business logic lives in custom hooks; App.jsx and components only call hooks. Pure logic is extracted into testable utility functions.

**Tech Stack:** React 18, Vite 5, Supabase JS v2, Framer Motion 11, Lucide React, Vitest (added in Task 1)

---

## File Map

**Create:**
- `src/lib/financeUtils.js` — pure utility functions (totals, 30-day check, receivable eligibility)
- `src/hooks/useReceivables.js` — CRUD + invoice logic for receivables
- `src/hooks/useActivityTemplates.js` — CRUD for activity templates
- `src/components/Finance/ReceivablesList.jsx` — table of pending receivables with Faturar button
- `src/components/Finance/FinanceSummary.jsx` — 5-card totals panel above Finance tabs
- `src/components/Activities/ActivityTemplateForm.jsx` — create/edit template modal
- `src/components/Activities/TemplatesTab.jsx` — list of templates with CRUD actions
- `src/components/Archive/ArchiveView.jsx` — paginated archive screen
- `src/supabase_migrations_2026.sql` — all 4 DB schema changes

**Modify:**
- `src/hooks/useAccounts.js` — add `getPrincipalAccount`, `setAccountCategory`, `getUniqueCategories`
- `src/hooks/useTransactions.js` — expose `cleared` filter support
- `src/components/Finance/AccountForm.jsx` — add category field with `+ Nova categoria`
- `src/components/Finance/AccountCard.jsx` — add category badge
- `src/components/Finance/FinanceView.jsx` — add `FinanceSummary` above tabs + A Receber tab + `useReceivables`
- `src/components/Tasks/KanbanView.jsx` — 30-day filter on terminal column
- `src/App.jsx` — set `completed_at` on first terminal entry; trigger `createReceivable`; archive/restore; add Archive route
- `src/components/Tasks/TaskModal.jsx` — receivable status badge + Faturar button + archive action
- `src/components/Activities/ActivitiesView.jsx` — add Modelos tab
- `src/components/Activities/ActivityForm.jsx` — add "Usar Modelo" button
- `src/components/Sidebar.jsx` — add Arquivo nav item

**Tests:**
- `src/lib/financeUtils.test.js`

---

## Task 1: DB Migration

**Files:**
- Create: `src/supabase_migrations_2026.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- src/supabase_migrations_2026.sql
-- Run this in Supabase SQL editor

-- 1. Receivables: tracks sales tasks awaiting payment
CREATE TABLE IF NOT EXISTS receivables (
  id                BIGSERIAL PRIMARY KEY,
  task_id           BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,               -- in cents
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'invoiced')),
  target_account_id BIGINT REFERENCES accounts(id),
  transaction_id    BIGINT REFERENCES transactions(id),
  invoiced_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON receivables FOR ALL USING (true) WITH CHECK (true);

-- 2. Account categories
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'extras';

-- 3. Activity templates
CREATE TABLE IF NOT EXISTS activity_templates (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  type                 TEXT,
  default_notes        TEXT,
  default_assigned_to  TEXT,
  tags                 TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON activity_templates FOR ALL USING (true) WITH CHECK (true);

-- 4. Task archiving + completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

- [ ] **Step 2: Run migration in Supabase**

Open Supabase Dashboard → SQL Editor → paste and run the file above.
Expected: 0 errors. All statements return `SUCCESS`.

- [ ] **Step 3: Verify in Table Editor**

Check that:
- `receivables` table exists with all columns
- `accounts` has a `category` column (existing rows show `extras`)
- `activity_templates` table exists
- `tasks` has `archived_at` and `completed_at` columns (both nullable)

- [ ] **Step 4: Commit**

```bash
git add src/supabase_migrations_2026.sql
git commit -m "feat: add DB schema for receivables, account categories, activity templates, task archiving"
```

---

## Task 2: Add Vitest + Pure Utility Tests (TDD foundation)

**Files:**
- Create: `src/lib/financeUtils.js`
- Create: `src/lib/financeUtils.test.js`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests**

```js
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
})
```

- [ ] **Step 3: Run tests — expect all to FAIL**

```bash
npm test
```
Expected: `Cannot find module './financeUtils'`

- [ ] **Step 4: Implement `financeUtils.js`**

```js
// src/lib/financeUtils.js

/**
 * Returns true if a receivable should be auto-created for a completed Vendas task.
 * Guards against: wrong category, zero/null deal_value, existing pending receivable.
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
```

- [ ] **Step 5: Run tests — expect all to PASS**

```bash
npm test
```
Expected: `✓ financeUtils.test.js (14 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/lib/financeUtils.js src/lib/financeUtils.test.js package.json
git commit -m "feat: add financeUtils pure functions with Vitest tests"
```

---

## Task 3: Account Categorization — `useAccounts` extensions

**Files:**
- Modify: `src/hooks/useAccounts.js`

- [ ] **Step 1: Add helpers to `useAccounts`**

Below the existing `closeAccount` function, add:

```js
// Returns the active Principal account or null
const getPrincipalAccount = () => {
  return accounts.find(a => a.category === 'principal' && a.is_active !== false) ?? null
}

// Returns all distinct category values currently in use
const getUniqueCategories = () => {
  const defaults = ['principal', 'reserva', 'extras']
  const custom = accounts.map(a => a.category).filter(Boolean)
  return [...new Set([...defaults, ...custom])]
}

// Sets account category. For 'principal': demotes the previous principal first.
// demotedCategory: the category the outgoing principal is set to ('extras' or 'reserva')
const setAccountCategory = async (accountId, category, demotedCategory = 'extras') => {
  if (category === 'principal') {
    const current = getPrincipalAccount()
    if (current && current.id !== accountId) {
      await updateAccount(current.id, { category: demotedCategory })
    }
  }
  return updateAccount(accountId, { category })
}
```

Update the return statement:

```js
return {
  accounts, loading,
  addAccount, updateAccount, closeAccount,
  getPrincipalAccount, getUniqueCategories, setAccountCategory
}
```

- [ ] **Step 2: Manual verification**

Open app in browser → Finanças → Contas. Open browser devtools. Call in console:
```js
// The hook isn't directly accessible, but verify the column was migrated:
// existing accounts should show category field in Supabase table editor
```
Check Supabase Table Editor → accounts → all rows have `category = 'extras'` ✓

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAccounts.js
git commit -m "feat: add category helpers to useAccounts (getPrincipal, setCategory, getUniqueCategories)"
```

---

## Task 4: Account Categorization — UI (AccountForm + AccountCard)

**Files:**
- Modify: `src/components/Finance/AccountForm.jsx`
- Modify: `src/components/Finance/AccountCard.jsx`

- [ ] **Step 1: Update `AccountForm` — add category field**

Read the full file first, then add:

1. Add `category` to initial form state (default `'extras'`):
```js
const [form, setForm] = useState({
  name: '', type: 'checking', opening_balance: '', category: 'extras',
  ...  // existing fields
})
```

2. Populate from existing account in the edit useEffect:
```js
setForm({
  ...existingFields,
  category: account?.category ?? 'extras',
})
```

3. Add the category selector UI just before the submit button. It uses `getUniqueCategories()` from `useAccounts` — pass it as a prop `categories` to `AccountForm`, or import the hook inside the form (follow existing pattern):

```jsx
{/* Category field */}
<div className="form-group">
  <label>Categoria</label>
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <select
      value={form.category}
      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
      className="form-input"
    >
      {categories.map(c => (
        <option key={c} value={c}>
          {c.charAt(0).toUpperCase() + c.slice(1)}
        </option>
      ))}
      <option value="__new__">+ Nova categoria</option>
    </select>
    {form.category === '__new__' && (
      <input
        autoFocus
        className="form-input"
        placeholder="Nome da categoria"
        onBlur={e => {
          const val = e.target.value.trim().toLowerCase()
          if (val) setForm(f => ({ ...f, category: val }))
          else setForm(f => ({ ...f, category: 'extras' }))
        }}
      />
    )}
  </div>
</div>
```

4. Add the `categories` prop to the component signature:
```js
export default function AccountForm({ account, onSave, onClose, categories = ['principal','reserva','extras'] }) {
```

5. When saving, if the new category is `'principal'`, show an inline confirmation if another principal exists. Pass `existingPrincipal` as a prop and handle:
```jsx
// In the submit handler, before calling onSave:
if (form.category === 'principal' && existingPrincipal && existingPrincipal.id !== account?.id) {
  const demoteTo = window.confirm // NEVER use window.confirm
  // Instead: show inline state:
  setShowDemoteConfirm(true)
  return
}
```

Add a `showDemoteConfirm` state and a small inline confirmation banner:
```jsx
{showDemoteConfirm && (
  <div className="alert-inline">
    <p>A conta <strong>{existingPrincipal?.name}</strong> perderá a categoria Principal.</p>
    <label>Passar para:</label>
    <select value={demotedCategory} onChange={e => setDemotedCategory(e.target.value)}>
      <option value="extras">Extras</option>
      <option value="reserva">Reserva</option>
    </select>
    <button onClick={confirmSave}>Confirmar</button>
    <button onClick={() => setShowDemoteConfirm(false)}>Cancelar</button>
  </div>
)}
```

- [ ] **Step 2: Update `AccountCard` — category badge**

In `AccountCard.jsx`, add after the account type icon:

```jsx
const CATEGORY_BADGE = {
  principal: { label: 'Principal', color: '#f59e0b' },   // gold
  reserva:   { label: 'Reserva',   color: '#3b82f6' },   // blue
  extras:    { label: 'Extras',    color: '#6b7280' },   // gray
}

// Inside the card JSX, below the account name:
{account.category && (
  <span
    className="account-category-badge"
    style={{
      background: (CATEGORY_BADGE[account.category] ?? { color: '#9ca3af' }).color + '22',
      color: (CATEGORY_BADGE[account.category] ?? { color: '#9ca3af' }).color,
      border: `1px solid ${(CATEGORY_BADGE[account.category] ?? { color: '#9ca3af' }).color}44`,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
    }}
  >
    {(CATEGORY_BADGE[account.category] ?? { label: account.category }).label}
  </span>
)}
```

- [ ] **Step 3: Wire `AccountForm` in `FinanceView`**

In `FinanceView.jsx`, pass the new props to `AccountForm`:
```jsx
<AccountForm
  account={editingAccount}
  onSave={handleSaveAccount}
  onClose={() => setEditingAccount(null)}
  categories={getUniqueCategories()}
  existingPrincipal={getPrincipalAccount()}
/>
```

Update `handleSaveAccount` to call `setAccountCategory` when the category changes:
```js
const handleSaveAccount = async (formData, demotedCategory) => {
  const { category, ...rest } = formData
  if (editingAccount) {
    await updateAccount(editingAccount.id, rest)
    if (category !== editingAccount.category) {
      await setAccountCategory(editingAccount.id, category, demotedCategory)
    }
  } else {
    const saved = await addAccount(rest)
    if (saved && category !== 'extras') {
      await setAccountCategory(saved.id, category, demotedCategory)
    }
  }
}
```

- [ ] **Step 4: Browser verification**

1. Run `npm run dev`
2. Navigate to Finanças → Contas
3. Edit an account → Categoria dropdown shows Principal / Reserva / Extras / + Nova categoria ✓
4. Select Principal on a second account → demotion confirmation banner appears ✓
5. Confirm → first account badge changes to Extras, second shows Principal (gold) ✓
6. Create a custom category "Investimentos" → appears in dropdown on future opens ✓

- [ ] **Step 5: Commit**

```bash
git add src/components/Finance/AccountForm.jsx src/components/Finance/AccountCard.jsx src/components/Finance/FinanceView.jsx
git commit -m "feat: add account categorization UI with demotion confirmation and category badges"
```

---

## Task 5: `useReceivables` Hook

**Files:**
- Create: `src/hooks/useReceivables.js`

- [ ] **Step 1: Write the hook**

```js
// src/hooks/useReceivables.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useReceivables() {
  const [receivables, setReceivables] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('receivables')
      .select(`
        *,
        tasks ( title, category, client_id ),
        accounts ( name )
      `)
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching receivables:', error)
    else setReceivables(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  /**
   * Creates a receivable for a completed Vendas task.
   * Callers MUST run shouldCreateReceivable() before calling this.
   */
  const createReceivable = async (taskId, amount, targetAccountId) => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('receivables')
      .insert([{ task_id: taskId, amount, target_account_id: targetAccountId, status: 'pending' }])
      .select()
    if (error) { console.error('Error creating receivable:', error); return null }
    await fetch()
    return data[0]
  }

  /**
   * Marks a receivable as invoiced and creates a real transaction.
   * Uses addTransaction from useTransactions for rules engine + needs_review logic.
   */
  const invoiceReceivable = async (receivableId, adjustedAmount, date, addTransaction) => {
    if (!supabase) return null
    const rec = receivables.find(r => r.id === receivableId)
    if (!rec) return null

    // Create the real transaction via the existing hook (gets rules engine + needs_review)
    const tx = await addTransaction({
      account_id: rec.target_account_id,
      amount: adjustedAmount,
      date,
      notes: `Faturamento: ${rec.tasks?.title ?? 'tarefa'}`,
      related_to: [{ type: 'task', id: rec.task_id }],
    })
    if (!tx) return null

    // Mark receivable as invoiced
    const { data, error } = await supabase
      .from('receivables')
      .update({ status: 'invoiced', transaction_id: tx.id, invoiced_at: new Date().toISOString() })
      .eq('id', receivableId)
      .select()
    if (error) { console.error('Error invoicing receivable:', error); return null }
    setReceivables(prev => prev.map(r => r.id === receivableId ? data[0] : r))
    return data[0]
  }

  /**
   * Returns receivables filtered by optional status and/or taskId.
   */
  const listReceivables = ({ status, taskId } = {}) => {
    return receivables.filter(r => {
      if (status && r.status !== status) return false
      if (taskId && r.task_id !== taskId) return false
      return true
    })
  }

  return { receivables, loading, createReceivable, invoiceReceivable, listReceivables, refresh: fetch }
}
```

- [ ] **Step 2: Browser verification**

Open app → Finanças tab. Open browser console and check for errors. No errors = hook loaded correctly.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReceivables.js
git commit -m "feat: add useReceivables hook with create, invoice, and list operations"
```

---

## Task 6: Wire Receivable Trigger + `completed_at` in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

```js
import { useReceivables } from './hooks/useReceivables'
import { shouldCreateReceivable, getPrincipalAccount as getPrincipal } from './lib/financeUtils'
```

- [ ] **Step 2: Instantiate `useReceivables` in App**

Inside the `App` component, after existing hooks:
```js
const { createReceivable, listReceivables } = useReceivables()
```

- [ ] **Step 3: Update `updateTask` to set `completed_at` and trigger receivable**

Replace the existing `updateTask` function:

```js
const updateTask = async (id, updates) => {
  const { related_to, ...cleanUpdates } = updates

  // Set completed_at the first time the task enters the terminal column
  const terminalColumnName = columns[columns.length - 1]?.name
  const task = tasks.find(t => t.id === id)
  if (
    terminalColumnName &&
    cleanUpdates.status === terminalColumnName &&
    task?.status !== terminalColumnName &&
    !task?.completed_at
  ) {
    cleanUpdates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(cleanUpdates)
    .eq('id', id)
    .select()

  if (error) {
    console.error('Error updating task:', error)
    alert('Erro ao atualizar tarefa: ' + error.message)
    return
  }

  const updatedTask = data[0]
  setTasks(prev => prev.map(t => t.id === id ? updatedTask : t))

  // Auto-create receivable when Vendas task reaches terminal column
  if (
    terminalColumnName &&
    cleanUpdates.status === terminalColumnName &&
    task?.status !== terminalColumnName
  ) {
    const existing = listReceivables({ taskId: id })
    if (shouldCreateReceivable(updatedTask, existing)) {
      const allAccounts = await supabase.from('accounts').select('*').then(r => r.data || [])
      const principal = getPrincipal(allAccounts)
      if (principal) {
        await createReceivable(id, updatedTask.deal_value, principal.id)
        // Toast notification — reuse existing pattern or a simple alert
        console.info(`Valor a Receber de R$ ${(updatedTask.deal_value / 100).toFixed(2)} criado em Finanças`)
      } else {
        alert('Nenhuma conta Principal definida. Defina uma conta como Principal em Finanças → Contas.')
      }
    }
  }
}
```

> **Note:** This fetches accounts directly from Supabase instead of relying on `useAccounts` (which lives in FinanceView's scope). In a future refactor, accounts could be lifted to App-level state. For now this is acceptable.

- [ ] **Step 4: Add archive/restore functions**

```js
const archiveTask = async (id) => {
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('Error archiving task:', error); return }
  setTasks(prev => prev.filter(t => t.id !== id))
}

const restoreTask = async (id) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
  if (error) { console.error('Error restoring task:', error); return }
  setTasks(prev => prev.map(t => t.id === id ? data[0] : t))
}
```

- [ ] **Step 5: Pass archive handlers to TaskModal**

Find where `TaskModal` is rendered and add:
```jsx
<TaskModal
  ...existing props...
  onArchive={archiveTask}
/>
```

- [ ] **Step 6: Browser verification**

1. Create a task with category Vendas and deal_value > 0
2. Drag it to the terminal (Concluído) column
3. Check browser console → `"Valor a Receber de R$ X criado"` log appears
4. Check Supabase → `receivables` table has a new `pending` row for that task
5. Drag the same task off and back to terminal → no duplicate row created (idempotency ✓)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: auto-create receivable on Vendas task completion and set completed_at"
```

---

## Task 7: `ReceivablesList` Component

**Files:**
- Create: `src/components/Finance/ReceivablesList.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/Finance/ReceivablesList.jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { centsToReal } from '../../lib/finUtils'

export default function ReceivablesList({ receivables, onInvoice }) {
  const [invoicingId, setInvoicingId] = useState(null)
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', date: '' })

  const pending = receivables.filter(r => r.status === 'pending')

  const openInvoice = (r) => {
    setInvoicingId(r.id)
    setInvoiceForm({
      amount: (r.amount / 100).toFixed(2).replace('.', ','),
      date: new Date().toISOString().slice(0, 10),
    })
  }

  const handleConfirm = async () => {
    const amountCents = Math.round(
      parseFloat(invoiceForm.amount.replace(',', '.')) * 100
    )
    await onInvoice(invoicingId, amountCents, invoiceForm.date)
    setInvoicingId(null)
  }

  if (pending.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', padding: 24 }}>Nenhum valor a receber pendente.</p>
  }

  return (
    <div className="receivables-list">
      {pending.map(r => (
        <div key={r.id} className="receivable-row">
          <div className="receivable-info">
            <span className="receivable-task">{r.tasks?.title ?? '—'}</span>
            <span className="receivable-account">{r.accounts?.name ?? '—'}</span>
            <span className="receivable-date">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <span className="receivable-amount">{centsToReal(r.amount)}</span>

          {invoicingId === r.id ? (
            <div className="invoice-confirm">
              <input
                type="text"
                className="form-input"
                value={invoiceForm.amount}
                onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                style={{ width: 100 }}
              />
              <input
                type="date"
                className="form-input"
                value={invoiceForm.date}
                onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))}
              />
              <button className="btn-primary" onClick={handleConfirm}>Confirmar</button>
              <button className="btn-ghost" onClick={() => setInvoicingId(null)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => openInvoice(r)}>
              <CheckCircle size={14} /> Faturar
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add to `FinanceView` as a new tab**

In `FinanceView.jsx`:
1. Import `ReceivablesList` and `useReceivables`
2. Instantiate hook: `const { listReceivables, invoiceReceivable } = useReceivables()`
3. Add tab button: `<button onClick={() => setActiveTab('receber')}>A Receber</button>`
4. Add tab content:
```jsx
{activeTab === 'receber' && (
  <ReceivablesList
    receivables={listReceivables({ status: 'pending' })}
    onInvoice={(id, amount, date) => invoiceReceivable(id, amount, date, addTransaction)}
  />
)}
```

- [ ] **Step 3: Browser verification**

1. Confirm a Vendas task completion created a receivable (Task 6)
2. Navigate to Finanças → A Receber tab
3. The pending receivable appears in the list ✓
4. Click Faturar → confirmation form shows with editable amount and date ✓
5. Confirm → receivable disappears from list; check Supabase `transactions` table for new row ✓
6. Check the Contas tab balance updated ✓

- [ ] **Step 4: Commit**

```bash
git add src/components/Finance/ReceivablesList.jsx src/components/Finance/FinanceView.jsx src/hooks/useReceivables.js
git commit -m "feat: add A Receber tab to Finance with ReceivablesList and invoice flow"
```

---

## Task 8: TaskModal — Receivable Badge + Faturar + Archive

**Files:**
- Modify: `src/components/Tasks/TaskModal.jsx`

- [ ] **Step 1: Add receivable state display**

In `TaskModal`, receive `onArchive` prop and the receivable for this task.
Pass `taskReceivable` from parent (App.jsx provides it) or query inside the modal using `useReceivables`.

Simpler approach — query in the modal:
```js
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'

// Inside TaskModal component:
const { listReceivables, invoiceReceivable } = useReceivables()
const { addTransaction } = useTransactions()
const taskReceivable = task ? listReceivables({ taskId: task.id })[0] : null
```

- [ ] **Step 2: Add receivable badge in the modal header/info area**

```jsx
{taskReceivable && (
  <div className="receivable-badge">
    {taskReceivable.status === 'pending' ? (
      <>
        <span className="badge badge-warning">⏳ Aguardando Faturamento</span>
        <button
          className="btn-primary btn-sm"
          onClick={() => setShowInvoiceForm(true)}
        >
          Faturar
        </button>
      </>
    ) : (
      <span className="badge badge-success">✓ Faturado</span>
    )}
  </div>
)}
```

- [ ] **Step 3: Add inline invoice form in modal**

```jsx
{showInvoiceForm && taskReceivable && (
  <div className="invoice-form-inline">
    <h4>Confirmar Faturamento</h4>
    <label>Valor recebido</label>
    <input
      type="text"
      className="form-input"
      value={invoiceAmount}
      onChange={e => setInvoiceAmount(e.target.value)}
    />
    <label>Data de recebimento</label>
    <input
      type="date"
      className="form-input"
      value={invoiceDate}
      onChange={e => setInvoiceDate(e.target.value)}
    />
    <div className="form-actions">
      <button className="btn-primary" onClick={handleInvoice}>Confirmar</button>
      <button className="btn-ghost" onClick={() => setShowInvoiceForm(false)}>Cancelar</button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add Archive button to modal footer**

```jsx
{task && !task.archived_at && (
  <button
    className="btn-ghost btn-destructive"
    onClick={() => setShowArchiveConfirm(true)}
  >
    Arquivar
  </button>
)}

{showArchiveConfirm && (
  <div className="alert-inline">
    <span>Arquivar esta tarefa?</span>
    <button onClick={() => { onArchive(task.id); onClose() }}>Confirmar</button>
    <button onClick={() => setShowArchiveConfirm(false)}>Cancelar</button>
  </div>
)}
```

- [ ] **Step 5: Browser verification**

1. Open a Vendas task that has a pending receivable → badge "⏳ Aguardando Faturamento" + Faturar button ✓
2. Click Faturar in modal → invoice form appears ✓
3. Confirm → badge changes to "✓ Faturado" ✓
4. Open any task → Archive button in footer ✓
5. Confirm archive → task disappears from Kanban ✓

- [ ] **Step 6: Commit**

```bash
git add src/components/Tasks/TaskModal.jsx
git commit -m "feat: add receivable status badge, Faturar button, and archive action to TaskModal"
```

---

## Task 9: `useTransactions` — expose `cleared` filter + `FinanceSummary`

**Files:**
- Modify: `src/hooks/useTransactions.js`
- Create: `src/components/Finance/FinanceSummary.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`

- [ ] **Step 1: Add `cleared` filter to `useTransactions`**

In the query building block, add:
```js
if (filters?.cleared !== undefined) query = query.eq('cleared', filters.cleared)
```

- [ ] **Step 2: Create `FinanceSummary` component**

```jsx
// src/components/Finance/FinanceSummary.jsx
import { TrendingUp, TrendingDown, Wallet, Star, Eye } from 'lucide-react'
import { calculateFinanceTotals } from '../../lib/financeUtils'
import { centsToReal } from '../../lib/finUtils'

export default function FinanceSummary({ accounts, transactions, receivables }) {
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
      onClick: () => {} // parent sets this
    },
    {
      label: 'A Pagar',
      value: totals.totalPayable,
      icon: <TrendingDown size={18} />,
      color: '#EE5D50',
      isNegative: true,
    },
    {
      label: 'Saldo Previsto',
      value: totals.projectedBalance,
      icon: <Eye size={18} />,
      color: totals.projectedBalance >= 0 ? '#05CD99' : '#EE5D50',
    },
  ]

  return (
    <div className="finance-summary" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {cards.map(card => (
        <div
          key={card.label}
          className="stat-card"
          style={{ flex: '1 1 160px', cursor: card.onClick ? 'pointer' : 'default' }}
          onClick={card.onClick}
        >
          <div className="stat-icon" style={{ color: card.color }}>{card.icon}</div>
          <div>
            <div className="stat-label">{card.label}</div>
            <div
              className="stat-value"
              style={{ color: card.isNegative ? '#EE5D50' : (card.value < 0 ? '#EE5D50' : 'inherit') }}
            >
              {centsToReal(Math.abs(card.value))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Integrate `FinanceSummary` into `FinanceView`**

In `FinanceView.jsx`:

1. Add `useReceivables` instantiation:
```js
const { receivables } = useReceivables()
```

2. Add a dedicated unfiltered transactions query for the summary (separate from `effectiveFilters`):
```js
const { transactions: allTransactions } = useTransactions({})
```

3. Render `FinanceSummary` above the tab buttons (outside tab content):
```jsx
<FinanceSummary
  accounts={accounts}
  transactions={allTransactions}
  receivables={receivables}
/>
```

- [ ] **Step 4: Browser verification**

1. Navigate to Finanças
2. Five summary cards appear above the tabs ✓
3. Cards show correct values (verify against manual calculation in Supabase) ✓
4. Saldo Previsto = Saldo Total + A Receber - A Pagar ✓
5. Switch between tabs — cards remain visible ✓

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTransactions.js src/components/Finance/FinanceSummary.jsx src/components/Finance/FinanceView.jsx
git commit -m "feat: add FinanceSummary panel with 5 financial total cards above Finance tabs"
```

---

## Task 10: Activity Templates

**Files:**
- Create: `src/hooks/useActivityTemplates.js`
- Create: `src/components/Activities/ActivityTemplateForm.jsx`
- Create: `src/components/Activities/TemplatesTab.jsx`
- Modify: `src/components/Activities/ActivitiesView.jsx`
- Modify: `src/components/Activities/ActivityForm.jsx`

- [ ] **Step 1: Create `useActivityTemplates` hook**

```js
// src/hooks/useActivityTemplates.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useActivityTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('activity_templates')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching templates:', error)
        else setTemplates(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const createTemplate = async (data) => {
    if (!supabase) return null
    const { data: saved, error } = await supabase
      .from('activity_templates').insert([data]).select()
    if (error) { console.error('Error creating template:', error); return null }
    setTemplates(prev => [...prev, saved[0]])
    return saved[0]
  }

  const updateTemplate = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('activity_templates').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating template:', error); return null }
    setTemplates(prev => prev.map(t => t.id === id ? data[0] : t))
    return data[0]
  }

  const deleteTemplate = async (id) => {
    if (!supabase) return
    const { error } = await supabase.from('activity_templates').delete().eq('id', id)
    if (error) { console.error('Error deleting template:', error); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  /**
   * Returns form-ready pre-filled object from a template.
   * Never includes date, related_to, or status.
   */
  const applyTemplate = (templateId) => {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return {}
    return {
      title: tpl.name,
      type: tpl.type ?? 'task',
      body: tpl.default_notes ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tpl.default_notes }] }] } : null,
      created_by: tpl.default_assigned_to ?? '',
      tags: tpl.tags ?? [],
    }
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, applyTemplate }
}
```

- [ ] **Step 2: Create `ActivityTemplateForm`**

Create `src/components/Activities/ActivityTemplateForm.jsx` — a modal form with fields:
- `name` (text, required)
- `type` (select: meeting/call/email/whatsapp/note/task) — same options as `ActivityForm`
- `default_notes` (textarea)
- `default_assigned_to` (text)
- `tags` (comma-separated text input, stored as array)

Follow the same Framer Motion modal pattern as `ActivityForm.jsx`.

- [ ] **Step 3: Create `TemplatesTab`**

Create `src/components/Activities/TemplatesTab.jsx`:
- Lists templates with name, type, edit and delete buttons
- "+ Novo Modelo" button opens `ActivityTemplateForm`
- Empty state: "Nenhum modelo criado. Crie modelos para atividades recorrentes."

- [ ] **Step 4: Add Modelos tab to `ActivitiesView`**

In `ActivitiesView.jsx`:
1. Add `activeSubTab` state: `useState('atividades')`
2. Add tab buttons: Atividades | Modelos
3. Render `<TemplatesTab>` when `activeSubTab === 'modelos'`
4. Instantiate `useActivityTemplates()` and pass to `TemplatesTab`

- [ ] **Step 5: Add "Usar Modelo" to `ActivityForm`**

In `ActivityForm.jsx`:
1. Accept `templates` and `onApplyTemplate` props
2. Add a `<select>` or button above the form:
```jsx
<div className="template-selector">
  <select
    defaultValue=""
    onChange={e => {
      if (e.target.value) onApplyTemplate(Number(e.target.value))
    }}
  >
    <option value="">Usar modelo...</option>
    {templates.map(t => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
</div>
```
3. `onApplyTemplate` receives a template ID → calls `applyTemplate(id)` → merges into form state

- [ ] **Step 6: Browser verification**

1. Atividades → Modelos tab ✓
2. Create template "Abastecer o Carro" with type=task and default notes ✓
3. Click "+ Nova Atividade" → "Usar modelo..." dropdown shows the template ✓
4. Select it → title, type, and notes are pre-filled; date and related_to are empty ✓
5. Save → activity created with template data ✓

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useActivityTemplates.js src/components/Activities/ActivityTemplateForm.jsx src/components/Activities/TemplatesTab.jsx src/components/Activities/ActivitiesView.jsx src/components/Activities/ActivityForm.jsx
git commit -m "feat: add activity templates with Modelos tab and Usar Modelo selector"
```

---

## Task 11: Task Archiving — KanbanView 30-Day Filter

**Files:**
- Modify: `src/components/Tasks/KanbanView.jsx`

- [ ] **Step 1: Import the utility**

```js
import { isWithin30Days } from '../../lib/financeUtils'
```

- [ ] **Step 2: Filter tasks for the terminal column**

In `KanbanView`, find where tasks are mapped per column. Add filter for the terminal column:

```js
const terminalColumn = columns[columns.length - 1]

// In the column rendering, when building tasksForColumn:
const tasksForColumn = tasks.filter(t => {
  if (t.status !== column.name) return false
  if (t.archived_at) return false  // always exclude archived
  // For the terminal column: only show last 30 days (using completed_at)
  if (column.id === terminalColumn?.id) {
    return isWithin30Days(t.completed_at)
  }
  return true
})
```

- [ ] **Step 3: Add footer note to terminal column**

In the terminal column render (where `column.id === terminalColumn?.id`), add below the task list:

```jsx
{column.id === terminalColumn?.id && (
  <p className="column-footer-note">
    Exibindo tarefas dos últimos 30 dias
  </p>
)}
```

- [ ] **Step 4: Add archive action to Kanban card**

In `SortableTaskCard`, add an archive button to the card actions area:

```jsx
<button
  className="card-action-btn"
  title="Arquivar"
  onClick={e => { e.stopPropagation(); onArchive(task.id) }}
>
  <Archive size={12} />
</button>
```

Pass `onArchive` from `KanbanView` → from `App.jsx`'s `archiveTask`.

- [ ] **Step 5: Browser verification**

1. Completed tasks from more than 30 days ago are hidden from Concluído column ✓
2. Footer note "Exibindo tarefas dos últimos 30 dias" appears in terminal column ✓
3. Archive button on card → task disappears from Kanban ✓

- [ ] **Step 6: Commit**

```bash
git add src/components/Tasks/KanbanView.jsx
git commit -m "feat: filter Concluído column to 30 days and add archive action to Kanban cards"
```

---

## Task 12: Archive Screen

**Files:**
- Create: `src/components/Archive/ArchiveView.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `ArchiveView`**

```jsx
// src/components/Archive/ArchiveView.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { RotateCcw } from 'lucide-react'

const PAGE_SIZE = 50

export default function ArchiveView({ onRestore }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState({ category: '', tag: '' })

  const fetchArchived = async (pageNum = 0, currentFilters = filters) => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (currentFilters.category) query = query.eq('category', currentFilters.category)
    if (currentFilters.tag) query = query.contains('tags', [currentFilters.tag])

    const { data, error } = await query
    if (error) { console.error('Error fetching archive:', error); setLoading(false); return }
    if (pageNum === 0) setTasks(data || [])
    else setTasks(prev => [...prev, ...(data || [])])
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
  }

  useEffect(() => { fetchArchived(0) }, [])

  const handleRestore = async (id) => {
    await onRestore(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="archive-view">
      <h2>Arquivo</h2>

      <div className="archive-filters">
        <select value={filters.category} onChange={e => {
          const f = { ...filters, category: e.target.value }
          setFilters(f); setPage(0); fetchArchived(0, f)
        }}>
          <option value="">Todas as categorias</option>
          <option value="Vendas">Vendas</option>
          <option value="Operacional">Operacional</option>
          <option value="Pessoal">Pessoal</option>
        </select>
      </div>

      {loading && page === 0 ? (
        <p>Carregando...</p>
      ) : tasks.length === 0 ? (
        <p className="empty-state">Nenhuma tarefa arquivada.</p>
      ) : (
        <>
          <table className="archive-table">
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Arquivado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.category}</td>
                  <td>{t.priority}</td>
                  <td>{new Date(t.archived_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => handleRestore(t.id)}>
                      <RotateCcw size={13} /> Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button className="btn-ghost" onClick={() => {
              const next = page + 1; setPage(next); fetchArchived(next)
            }}>
              Carregar mais
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Arquivo to Sidebar**

In `Sidebar.jsx`, import `Archive` from `lucide-react` and add to the nav items array:

```jsx
{ id: 'arquivo', label: 'Arquivo', icon: <Archive size={18} /> }
```

- [ ] **Step 3: Add Archive route to `App.jsx`**

1. Import `ArchiveView`
2. In the content area conditional rendering, add:
```jsx
{activeTab === 'arquivo' && (
  <ArchiveView onRestore={restoreTask} />
)}
```
3. Pass `onArchive={archiveTask}` to `KanbanView` and `TaskModal` (ensure already done in Task 6)

- [ ] **Step 4: Browser verification**

1. Sidebar shows "Arquivo" item ✓
2. Archive 2-3 tasks
3. Click Arquivo in sidebar → archived tasks listed with archive dates ✓
4. Click Restaurar on one → it reappears in Kanban ✓
5. Category filter works ✓
6. Archived tasks not shown in CommandPalette by default ✓ (filtered by `archived_at IS NULL` — this already works because `tasks` in App.jsx excludes archived rows after archiving sets the filter)

> **Note:** CommandPalette exclusion is automatic because App.jsx's `tasks` state removes archived tasks on archive. No additional change needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/Archive/ArchiveView.jsx src/components/Sidebar.jsx src/App.jsx
git commit -m "feat: add Archive screen with restore, pagination, and sidebar navigation"
```

---

## Final Verification

- [ ] Run `npm test` — all 14 tests pass
- [ ] Run `npm run lint` — 0 errors
- [ ] Run `npm run build` — build succeeds

```bash
npm test && npm run lint && npm run build
```

- [ ] **End-to-end smoke test:**

1. Create Vendas task with R$ 500 deal value → complete it → A Receber shows R$ 500 ✓
2. Faturar in Finance → balance updates in FinanceSummary ✓
3. Faturar in TaskModal → badge shows "Faturado ✓" ✓
4. Add "Reserva" category to a second account ✓
5. Change account to Principal → demotion confirmation → badge changes ✓
6. Create activity template "Passear com cachorro" → use it in new activity ✓
7. Archive task → Arquivo screen shows it → Restore → back in Kanban ✓
8. Concluído column shows only last 30 days with footer note ✓

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: complete finance integration, account categories, activity templates, and task archiving"
```
