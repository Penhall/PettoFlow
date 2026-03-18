# Design: Finance Integration & Productivity Features
**Date:** 2026-03-18
**Status:** Approved (rev 2 — post spec-review fixes)

## Overview

Five interconnected features to integrate task management with finances, add account categorization, introduce activity templates, enrich the finance dashboard, and clean up the completed tasks column.

---

## Feature 1: Sales Task → Finance Integration

### Trigger Definition
- The auto-creation fires when a task with `category === 'Vendas'` is saved with a status that matches the **last column by index** (`columns[columns.length - 1].id`), consistent with how `KanbanView.jsx` currently identifies the terminal column
- **Idempotency guard (required):** Before calling `createReceivable`, always check if a `pending` receivable already exists for `task.id`. If one exists, skip silently. This prevents duplicate creation from repeated `onUpdateTask` calls during drag-and-drop across multiple intermediate columns
- If `deal_value` is zero or null: show warning toast and skip creation
- If no Principal account exists: show warning toast and open a manual account selector modal

### Receivable Creation Flow
1. Task with `category === 'Vendas'` reaches terminal column
2. Check: `receivables.findByTaskId(taskId, status: 'pending')` → if found, stop
3. Call `createReceivable(taskId, deal_value, principalAccountId)`
4. Show toast: *"Valor a Receber de R$ X criado em Finanças"*

### "Faturar" in TaskModal
- If task has a `pending` receivable: show badge **"Aguardando Faturamento"** + **"Faturar"** button
- On click: inline confirmation modal with editable amount + receipt date
- On confirm: call `invoiceReceivable(receivableId, adjustedAmount, date)`
- Badge updates to **"Faturado ✓"**

### "Faturar" in Finance module
- New **"A Receber"** tab/section in Finance lists all `pending` receivables
- Each row: task name, client, amount, creation date, **"Faturar"** button
- Same `invoiceReceivable` call — both views stay in sync via hook re-fetch

### Hook: `useReceivables`

```js
createReceivable(taskId, amount, accountId)
  // Inserts into receivables table with status='pending'

invoiceReceivable(receivableId, adjustedAmount, date)
  // Calls useTransactions.addTransaction() — not a raw Supabase insert
  // This ensures the rules engine and needs_review logic run as usual
  // Then sets receivable.status = 'invoiced' and receivable.transaction_id

listReceivables({ status?, taskId? })
  // taskId is optional: omit for global list (Finance panel), pass for task-scoped display
  // Returns receivables joined with task title and client name for display
```

---

## Feature 2: Account Categorization

### Rules
- Categories: **Principal**, **Reserva**, **Extras** (defaults) + user-defined custom categories
- Only **one** account can be `Principal` at a time
- Setting a new account as Principal: show a **confirmation modal** — *"A conta [X] perderá a categoria Principal e passará a ser [Extras/Reserva — user selects]. Confirmar?"* — rather than a silent auto-demotion
- Multiple accounts allowed per other category

### Race Condition Trade-off
- Uniqueness for `'principal'` is enforced at application level only (no DB constraint)
- This is an accepted trade-off for a single-user app where concurrent saves are negligible
- If multi-user access is added in the future, a DB trigger or advisory lock should be introduced

### Schema
- Add `category text DEFAULT 'extras'` to `accounts` table

### UI
- `AccountForm`: `Categoria` field — select with existing categories + `+ Nova categoria` inline input
- `AccountCard`: colored badge per category (Principal = gold, Reserva = blue, Extras = gray, custom = neutral)

### Hook extensions (`useAccounts`)
```js
getPrincipalAccount()              // Returns account where category = 'principal'
setAccountCategory(accountId, category, demotedCategory?)
  // Handles confirmation and uniqueness logic for 'principal'
  // demotedCategory: what the previous Principal becomes ('extras' | 'reserva' | custom)
getUniqueCategories()              // Returns all categories in use (for dynamic select)
```

---

## Feature 3: Activity Templates

### Template Model (table: `activity_templates`)
```sql
id, name (required), type, default_notes, default_assigned_to, tags[], created_at
```

### UI
- New **"Modelos"** tab in Activities module
- List of templates with **"+ Novo Modelo"** button, edit/delete per row
- `ActivityTemplateForm` fields: Name (required), Type, Default Notes, Default Assignee, Tags

### Usage
- In `ActivityForm`: **"Usar Modelo"** button opens a template selector
- On select: pre-fills form fields — all fields remain editable before saving
- `date`, `related_to`, and `status` are **never** sourced from templates — always set manually

### Hook: `useActivityTemplates`
```js
listTemplates()
createTemplate(data)
updateTemplate(id, data)
deleteTemplate(id)
applyTemplate(templateId)   // Returns pre-filled form object (no side effects)
```

---

## Feature 4: Finance Panel Totals

### Component: `FinanceSummary`
- Placed **outside the tab content area** at the top of `FinanceView`, always visible regardless of active tab
- Requires its own **unfiltered** data sources — it cannot rely on the `transactions` already in scope (which may be filtered by date/account when `activeTab === 'extrato'`)
- `FinanceView` must instantiate `useReceivables()` in addition to existing hooks

### Cards

| Card | Calculation |
|------|-------------|
| **Saldo Total** | Sum of current balances across all active accounts (from `useAccounts`) |
| **Conta Principal** | Isolated balance of the account with `category = 'principal'` |
| **A Receber** | Sum of all `receivables` with `status = 'pending'` (from `useReceivables`) |
| **A Pagar** | Sum of transactions where `amount < 0 AND cleared = false` — using an **unfiltered** `useTransactions` call. Note: `cleared` exists in the DB schema (`supabase_financial_module.sql`) but is not yet exposed in `useTransactions.js` — the hook must be extended to support `filters.cleared` |
| **Saldo Previsto** | Saldo Total + A Receber − A Pagar |

### Behavior
- Negative values in red, positive in green, neutral in theme default color
- **Clickable:** "A Receber" navigates to the A Receber section; "A Pagar" filters transactions to show only `cleared = false AND amount < 0`

---

## Feature 5: Completed Tasks — 30-Day Filter + Archiving

### Schema additions to `tasks`
```sql
archived_at   TIMESTAMPTZ   -- NULL = active; populated = archived
completed_at  TIMESTAMPTZ   -- Set when task first enters the terminal column
```
Use `completed_at` (not `updated_at`) for the 30-day filter. `updated_at` changes on any field edit and would cause completed tasks to reappear after being edited.

### Kanban Filter
- Terminal column shows only tasks where `completed_at >= today - 30 days AND archived_at IS NULL`
- Filter applied in frontend
- Footer note in column: *"Exibindo tarefas dos últimos 30 dias"*
- Tasks older than 30 days are not deleted — they are accessible via the Archive screen

### `completed_at` population
- Set `completed_at = now()` the **first time** a task enters the terminal column (only if `completed_at IS NULL`)
- Never overwritten on subsequent status changes

### Manual Archive
- **Kanban card**: archive icon in card action menu (alongside edit/delete)
- **TaskModal**: **"Arquivar"** button in footer with inline confirmation
- Action: sets `archived_at = now()` — task immediately disappears from Kanban

### Receivable State on Archive/Restore
- **On archive:** The associated `pending` receivable (if any) is **not deleted** — it remains visible in the Finance "A Receber" section and can still be invoiced
- **On restore:** Clear `archived_at` only. The idempotency guard in `createReceivable` (Feature 1 issue #2) prevents a duplicate receivable from being created if the task re-enters the terminal column

### Archive Screen
- New **"Arquivo"** entry in sidebar navigation (box/archive icon)
- Paginated list of all tasks with `archived_at IS NOT NULL`, sorted by `archived_at` descending
- **Pagination:** offset-based, 50 items per page
- Filters: by category, tag, date range (filters applied server-side via Supabase query)
- Each row has **"Restaurar"** button — clears `archived_at`, task returns to its current status column in Kanban
- Archived tasks excluded from global search (CommandPalette) by default — optional toggle **"Incluir arquivo"** in search

---

## Architecture Notes

### Data Flow Summary
```
Task (Vendas) → terminal column
  → check: pending receivable exists? → skip if yes
  → useReceivables.createReceivable()
    → receivables table (pending)
      → FinanceSummary: A Receber updates
      → TaskModal: badge "Aguardando Faturamento"
      → Finance "A Receber" tab

User clicks "Faturar"
  → useReceivables.invoiceReceivable()
    → useTransactions.addTransaction() [rules engine runs]
    → receivables.status = 'invoiced', transaction_id set
    → account balance updates via useAccounts
    → FinanceSummary: Saldo Total + Saldo Previsto update
```

### Files to Create
- `src/hooks/useReceivables.js`
- `src/hooks/useActivityTemplates.js`
- `src/components/Finance/ReceivablesList.jsx`
- `src/components/Finance/FinanceSummary.jsx`
- `src/components/Activities/ActivityTemplateForm.jsx`
- `src/components/Activities/TemplatesTab.jsx`
- `src/components/Archive/ArchiveView.jsx`

### Files to Modify
- `src/hooks/useAccounts.js` — add `getPrincipalAccount`, `setAccountCategory`, `getUniqueCategories`
- `src/hooks/useTransactions.js` — expose `cleared` filter support
- `src/components/Finance/FinanceView.jsx` — add `FinanceSummary` (outside tabs) + A Receber tab + `useReceivables` hook
- `src/components/Finance/AccountForm.jsx` — add category field with `+ Nova categoria`
- `src/components/Finance/AccountCard.jsx` — add category badge
- `src/components/Tasks/KanbanView.jsx` — trigger receivable creation on terminal column drop + 30-day filter + set `completed_at`
- `src/components/Tasks/TaskModal.jsx` — receivable badge + Faturar button + archive action
- `src/components/Activities/ActivitiesView.jsx` — add Modelos tab
- `src/components/Activities/ActivityForm.jsx` — add "Usar Modelo" button
- `src/App.jsx` — add Archive route + sidebar entry
- `src/components/Sidebar.jsx` — add Arquivo nav item

### Database Migrations
```sql
-- 1. Receivables table
CREATE TABLE receivables (
  id               BIGSERIAL PRIMARY KEY,
  task_id          BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL, -- centavos
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invoiced')),
  target_account_id BIGINT REFERENCES accounts(id),
  transaction_id   BIGINT REFERENCES transactions(id),
  invoiced_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Account category
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'extras';

-- 3. Activity templates
CREATE TABLE activity_templates (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  type                 TEXT,
  default_notes        TEXT,
  default_assigned_to  TEXT,
  tags                 TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- 4. Task archiving + completed tracking
ALTER TABLE tasks ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMPTZ;
```
