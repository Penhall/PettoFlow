# Design: Finance Integration & Productivity Features
**Date:** 2026-03-18
**Status:** Approved

## Overview

Five interconnected features to integrate task management with finances, add account categorization, introduce activity templates, enrich the finance dashboard, and clean up the completed tasks column.

---

## Feature 1: Sales Task → Finance Integration

### Flow
1. When a task with `category === 'Vendas'` is moved to the final Kanban column (Concluído):
   - Automatically create a `receivables` record using `deal_value` as the amount
   - `target_account_id` defaults to the account with `category = 'principal'`
   - Show a confirmation toast: *"Valor a Receber de R$ X criado em Finanças"*
   - If `deal_value` is zero or null: show warning toast and skip creation
   - If no Principal account exists: show warning and open manual account selector

2. **"Faturar" in TaskModal:**
   - If task has a `pending` receivable: show badge **"Aguardando Faturamento"** + **"Faturar"** button
   - On click: inline confirmation modal with editable amount + receipt date
   - On confirm: create real `transaction` in Principal account, set `receivable.status = 'invoiced'`, update badge to **"Faturado ✓"**

3. **"Faturar" in Finance module:**
   - New **"Valores a Receber"** section in Finance lists all `pending` receivables
   - Each row: task name, client, amount, creation date, **"Faturar"** button
   - Same action as TaskModal — both stay in sync via hook re-fetch

### Hook: `useReceivables`
- `createReceivable(taskId, amount, accountId)`
- `invoiceReceivable(receivableId, adjustedAmount, date)` — creates transaction + updates status
- `listReceivables(status?)` — for panel and Finance list

---

## Feature 2: Account Categorization

### Rules
- Categories: **Principal**, **Reserva**, **Extras** (defaults) + user-defined custom categories
- Only **one** account can be `Principal` at a time
- Setting a new account as Principal auto-demotes the previous one to `Extras` (with UI warning)
- Multiple accounts allowed per other category

### Schema
- Add `category text DEFAULT 'extras'` column to `accounts` table
- Uniqueness for `'principal'` enforced at application level (not DB constraint)

### UI
- `AccountForm`: `Categoria` field — select with existing categories + `+ Nova categoria` inline input
- `AccountCard`: colored badge per category (Principal = gold, Reserva = blue, Extras = gray, custom = neutral)

### Hook extensions (`useAccounts`)
- `getPrincipalAccount()` — returns active Principal account
- `setAccountCategory(accountId, category)` — handles uniqueness logic for 'principal'
- `getUniqueCategories()` — returns all categories in use (for dynamic select)

---

## Feature 3: Activity Templates

### Template Model (table: `activity_templates`)
```
id, name, type, default_notes, default_assigned_to, tags[], created_at
```

### UI
- New **"Modelos"** tab in Activities module
- List of templates with **"+ Novo Modelo"** button, edit/delete per row
- `ActivityTemplateForm` fields: Name (required), Type, Default Notes, Default Assignee, Tags

### Usage
- In `ActivityForm`: **"Usar Modelo"** button opens a template selector
- On select: pre-fills form fields — all fields remain editable before saving
- Date, `related_to`, and status are **never** sourced from templates

### Hook: `useActivityTemplates`
- `listTemplates()`
- `createTemplate(data)`
- `updateTemplate(id, data)`
- `deleteTemplate(id)`
- `applyTemplate(templateId)` — returns pre-filled form object

---

## Feature 4: Finance Panel Totals

### Component: `FinanceSummary`
Placed at the top of `FinanceView`, same visual pattern as `Dashboard.jsx` metric cards.

| Card | Calculation |
|------|-------------|
| **Saldo Total** | Sum of current balances across all active accounts |
| **Conta Principal** | Isolated balance of the account with `category = 'principal'` |
| **A Receber** | Sum of all `receivables` with `status = 'pending'` |
| **A Pagar** | Sum of transactions with `amount < 0` and `cleared = false` |
| **Saldo Previsto** | Saldo Total + A Receber − A Pagar |

### Behavior
- All values calculated from data already loaded by existing hooks (`useAccounts`, `useTransactions`, `useReceivables`) — no additional queries
- Negative values in red, positive in green, neutral in theme default color
- **Clickable:** "A Receber" navigates to receivables section; "A Pagar" filters transactions to show only pending

---

## Feature 5: Completed Tasks — 30-Day Filter + Archiving

### Kanban Filter
- Final column (Concluído) shows only tasks where `updated_at >= today - 30 days AND archived_at IS NULL`
- Filter applied in frontend
- Footer note in the column: *"Exibindo tarefas dos últimos 30 dias"*
- Tasks older than 30 days automatically appear in the Archive (no explicit action needed)

### Manual Archive
- **Kanban card**: archive icon in card action menu (alongside edit/delete)
- **TaskModal**: **"Arquivar"** button in footer with inline confirmation
- Action: sets `archived_at = now()` — task immediately disappears from Kanban

### Archive Screen
- New **"Arquivo"** entry in sidebar navigation (box/archive icon)
- Paginated list of all tasks with `archived_at IS NOT NULL`, sorted by archive date descending
- Filters: by category, tag, date range
- Each row has **"Restaurar"** button — clears `archived_at`, task returns to Kanban in its current status column
- Archived tasks excluded from global search (CommandPalette) by default — optional toggle **"Incluir arquivo"**

---

## Architecture Notes

### Data Flow Summary
```
Task (Vendas) completed
  → useReceivables.createReceivable()
    → receivables table (pending)
      → FinanceSummary: A Receber updates
      → TaskModal: badge "Aguardando Faturamento"
      → Finance "Valores a Receber" list

User clicks "Faturar"
  → useReceivables.invoiceReceivable()
    → transactions table (cleared income)
    → receivables.status = 'invoiced'
    → account balance updates
    → FinanceSummary: Saldo Total updates
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
- `src/hooks/useAccounts.js` — add category helpers
- `src/components/Finance/FinanceView.jsx` — add FinanceSummary + Receivables tab
- `src/components/Finance/AccountForm.jsx` — add category field
- `src/components/Finance/AccountCard.jsx` — add category badge
- `src/components/Tasks/KanbanView.jsx` — auto-create receivable on status change + 30-day filter
- `src/components/Tasks/TaskModal.jsx` — receivable badge + Faturar button + archive action
- `src/components/Activities/ActivitiesView.jsx` — add Modelos tab
- `src/components/Activities/ActivityForm.jsx` — add "Usar Modelo" button
- `src/App.jsx` — add Archive route + sidebar entry
- `src/components/Sidebar.jsx` — add Arquivo nav item

### Database Migrations
1. `CREATE TABLE receivables (...)`
2. `ALTER TABLE accounts ADD COLUMN category text DEFAULT 'extras'`
3. `CREATE TABLE activity_templates (...)`
4. `ALTER TABLE tasks ADD COLUMN archived_at timestamptz`
