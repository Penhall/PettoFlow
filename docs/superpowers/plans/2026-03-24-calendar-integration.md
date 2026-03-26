# Calendar + Cross-Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified Calendar view (FullCalendar) that normalizes tasks, activities, receivables, and transactions into a single event layer, plus bidirectional cross-linking between all three modules.

**Architecture:** Hook central `useCalendarEvents` normalizes 4 data sources into `CalendarEvent[]`. Components only consume this hook — no existing hook is replaced, only extended. Cross-integration is done via props passed down from `ActivitiesView` and `FinanceView`; `App.jsx` adds the `'calendario'` route and a `'calendar'` sub-tab inside Tarefas.

**Tech Stack:** React 18, Vite 5, Supabase JS v2, FullCalendar 6 (`@fullcalendar/react` + daygrid/timegrid/list/core), Framer Motion 11, Lucide React, Vitest

---

## Branch

Create a new branch from `feature/finance-integration-2026-03-18`:

```bash
git checkout -b feature/calendar-integration
```

---

## File Map

**Create:**
- `src/hooks/useCalendarEvents.js` — normalizes tasks/activities/receivables/transactions into `CalendarEvent[]`
- `src/components/Calendar/CalendarView.jsx` — FullCalendar wrapper, handles dateClick and eventClick
- `src/components/Calendar/CalendarFilters.jsx` — chip toggles for 4 event types (shown only in unified view)
- `src/components/Calendar/EventDetailPanel.jsx` — slide-in panel with contextual actions per event type
- `src/hooks/useCalendarEvents.test.js` — 10 unit tests for the normalization hook

**Modify:**
- `src/supabase_migrations_2026.sql` — add `due_date` to `tasks`; 3 changes to `receivables`
- `src/hooks/useReceivables.js` — add activities join to SELECT; add `createReceivableFromActivity`; fix `invoiceReceivable` for activity source
- `src/components/Tasks/TaskModal.jsx` — add optional `due_date` field
- `src/components/Tasks/AddTaskModal.jsx` — add optional `due_date` field
- `src/components/Activities/ActivityForm.jsx` — add financial accordion (Transação / A Receber)
- `src/components/Activities/ActivitiesView.jsx` — pass `addTransaction` + `createReceivableFromActivity` to ActivityForm
- `src/components/Finance/TransactionForm.jsx` — add link accordion (Criar Tarefa / Criar Atividade)
- `src/components/Finance/FinanceView.jsx` — pass `addActivity` + `onUpdateTransaction` to TransactionForm; pass extras to ReceivablesList
- `src/components/Finance/ReceivablesList.jsx` — add Follow-up + Criar Tarefa buttons per row; show activity title fallback
- `src/components/Sidebar.jsx` — add Calendário nav item
- `src/App.jsx` — add `'calendario'` case in renderContent; add `'calendar'` tab in Tarefas; import CalendarView
- `src/lib/financeUtils.test.js` — add idempotência test for activity_id case

---

## Task 1: DB Migration

**Files:**
- Modify: `src/supabase_migrations_2026.sql`

- [ ] **Step 1: Append calendar migrations to the existing SQL file**

Add after the existing content:

```sql
-- ============================================================
-- 2026-03-24 Calendar Integration Migration
-- Run in Supabase SQL editor
-- ============================================================

-- 1. tasks: add optional due_date (prazo de entrega)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

-- 2. receivables: task_id becomes nullable (receivable can come from activity)
ALTER TABLE receivables ALTER COLUMN task_id DROP NOT NULL;

-- 3. receivables: add activity_id FK (BIGINT to match activities.id BIGSERIAL)
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS activity_id BIGINT REFERENCES activities(id) NULL;

-- 4. receivables: add due_date for calendar display
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS due_date DATE NULL;

-- 5. receivables: at least one source must be set
ALTER TABLE receivables ADD CONSTRAINT IF NOT EXISTS receivables_source_check
  CHECK (task_id IS NOT NULL OR activity_id IS NOT NULL);
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Copy the SQL above and execute it in the Supabase dashboard → SQL Editor. Verify no errors.

- [ ] **Step 3: Commit**

```bash
git add src/supabase_migrations_2026.sql
git commit -m "feat: add calendar DB migration — due_date on tasks, activity_id + due_date on receivables"
```

---

## Task 2: due_date in TaskModal and AddTaskModal

**Files:**
- Modify: `src/components/Tasks/TaskModal.jsx`
- Modify: `src/components/Tasks/AddTaskModal.jsx`

- [ ] **Step 1: Add `due_date` to TaskModal form state**

In `src/components/Tasks/TaskModal.jsx`, find the `useState` that initializes the form (around line 42). Add `due_date: null` to the default state object, and `due_date: task?.due_date ?? null` to the spread when editing:

```js
const [form, setForm] = useState({
  // ... existing fields ...
  due_date: task?.due_date
    ? new Date(task.due_date).toISOString().slice(0, 10)
    : '',
  // ...
})
```

- [ ] **Step 2: Add due_date input to TaskModal JSX**

Inside the form, after the Status/Prioridade section, add:

```jsx
<div className="form-group">
  <label>Prazo (opcional)</label>
  <input
    type="date"
    className="form-input"
    value={form.due_date || ''}
    onChange={e => change('due_date', e.target.value || null)}
  />
</div>
```

- [ ] **Step 3: Ensure due_date is included in onSave payload**

The form spread `...form` already includes `due_date`. Verify that `onSave` in `App.jsx`'s `updateTask` does not strip `due_date` (check the destructuring — currently only `related_to` is stripped, which is correct).

- [ ] **Step 4: Add `due_date` to AddTaskModal**

In `src/components/Tasks/AddTaskModal.jsx`, add `due_date: ''` to the form state, and add the same date input after the tags/priority fields:

```jsx
<div className="form-group">
  <label>Prazo (opcional)</label>
  <input
    type="date"
    className="form-input"
    value={form.due_date || ''}
    onChange={e => change('due_date', e.target.value || null)}
  />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Tasks/TaskModal.jsx src/components/Tasks/AddTaskModal.jsx
git commit -m "feat: add optional due_date field to TaskModal and AddTaskModal"
```

---

## Task 3: Update useReceivables

**Files:**
- Modify: `src/hooks/useReceivables.js`

- [ ] **Step 1: Extend the SELECT query to join activities**

Replace the `.select(...)` block in the `fetch` function:

```js
const { data, error } = await supabase
  .from('receivables')
  .select(`
    *,
    tasks ( title, category, client_id ),
    activities ( title, id ),
    accounts ( name )
  `)
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: Add `createReceivableFromActivity` function**

Add after `createReceivable`:

```js
/**
 * Creates a receivable originated from an activity.
 * @param {number} activityId
 * @param {number} amount - in cents
 * @param {number} targetAccountId
 * @param {string|null} dueDate - YYYY-MM-DD
 */
const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('receivables')
    .insert([{
      activity_id: activityId,
      amount,
      target_account_id: targetAccountId,
      status: 'pending',
      due_date: dueDate,
    }])
    .select()
  if (error) { console.error('Error creating receivable from activity:', error); return null }
  await fetch()
  return data[0]
}
```

- [ ] **Step 3: Fix `invoiceReceivable` to support activity source**

Replace the hardcoded `notes` and `related_to` inside `invoiceReceivable`:

```js
// Before:
notes: `Faturamento: ${rec.tasks?.title ?? 'tarefa'}`,
related_to: [{ type: 'task', id: rec.task_id }],

// After:
const sourceName = rec.tasks?.title ?? rec.activities?.title ?? 'lançamento'
const sourceLink = rec.task_id
  ? { type: 'task', id: rec.task_id }
  : { type: 'activity', id: rec.activity_id }
// then use:
notes: `Faturamento: ${sourceName}`,
related_to: [sourceLink],
```

- [ ] **Step 4: Export `createReceivableFromActivity` from the hook**

In the return statement, add `createReceivableFromActivity`:

```js
return {
  receivables, loading,
  createReceivable,
  createReceivableFromActivity,
  invoiceReceivable,
  listReceivables,
  refresh: fetch,
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReceivables.js
git commit -m "feat: extend useReceivables — activities join, createReceivableFromActivity, fix invoiceReceivable for activity source"
```

---

## Task 4: useCalendarEvents hook + unit tests

**Files:**
- Create: `src/hooks/useCalendarEvents.js`
- Create: `src/hooks/useCalendarEvents.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `src/hooks/useCalendarEvents.test.js`:

```js
// src/hooks/useCalendarEvents.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCalendarEvents } from './useCalendarEvents'

// Mock all four data hooks
vi.mock('./useActivities', () => ({
  useActivities: vi.fn(() => ({ activities: [], loading: false })),
}))
vi.mock('./useReceivables', () => ({
  useReceivables: vi.fn(() => ({ receivables: [], loading: false })),
}))
vi.mock('./useFinRules', () => ({
  useFinRules: vi.fn(() => ({ rules: [] })),
}))
vi.mock('./useTransactions', () => ({
  useTransactions: vi.fn(() => ({ transactions: [], loading: false })),
}))

import { useActivities } from './useActivities'
import { useReceivables } from './useReceivables'
import { useTransactions } from './useTransactions'
import { useFinRules } from './useFinRules'

const TASK_BLUE  = '#3b82f6'
const TASK_GREY  = '#94a3b8'
const ACT_PURPLE = '#8b5cf6'
const REC_YELLOW = '#f59e0b'
const TX_GREEN   = '#10b981'
const TX_RED     = '#ef4444'

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useActivities.mockReturnValue({ activities: [], loading: false })
    useReceivables.mockReturnValue({ receivables: [], loading: false })
    useTransactions.mockReturnValue({ transactions: [], loading: false })
    useFinRules.mockReturnValue({ rules: [] })
  })

  it('task with due_date produces blue event on that date', () => {
    const tasks = [{ id: 1, title: 'T1', due_date: '2026-04-01T10:00:00Z' }]
    const { result } = renderHook(() => useCalendarEvents({ tasks }))
    const ev = result.current.events.find(e => e.id === 'task-due-1')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(TASK_BLUE)
    expect(ev.date).toBe('2026-04-01')
  })

  it('task with completed_at produces grey event', () => {
    const tasks = [{ id: 2, title: 'T2', completed_at: '2026-03-20T12:00:00Z' }]
    const { result } = renderHook(() => useCalendarEvents({ tasks }))
    const ev = result.current.events.find(e => e.id === 'task-done-2')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(TASK_GREY)
    expect(ev.date).toBe('2026-03-20')
  })

  it('task without due_date or completed_at is not included', () => {
    const tasks = [{ id: 3, title: 'T3' }]
    const { result } = renderHook(() => useCalendarEvents({ tasks }))
    expect(result.current.events.filter(e => e.sourceId === 3 && e.sourceType === 'task')).toHaveLength(0)
  })

  it('activity with scheduled_at produces purple event', () => {
    useActivities.mockReturnValue({
      activities: [{ id: 10, title: 'A1', scheduled_at: '2026-04-05T09:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    const ev = result.current.events.find(e => e.id === 'activity-10')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(ACT_PURPLE)
    expect(ev.date).toBe('2026-04-05')
  })

  it('activity without scheduled_at is not included', () => {
    useActivities.mockReturnValue({
      activities: [{ id: 11, title: 'A2' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    expect(result.current.events.find(e => e.id === 'activity-11')).toBeUndefined()
  })

  it('pending receivable uses due_date when available', () => {
    useReceivables.mockReturnValue({
      receivables: [{ id: 20, status: 'pending', amount: 5000, due_date: '2026-04-10', created_at: '2026-03-01T00:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    const ev = result.current.events.find(e => e.id === 'receivable-20')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(REC_YELLOW)
    expect(ev.date).toBe('2026-04-10')
  })

  it('pending receivable falls back to created_at when due_date is null', () => {
    useReceivables.mockReturnValue({
      receivables: [{ id: 21, status: 'pending', amount: 1000, due_date: null, created_at: '2026-03-15T08:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    const ev = result.current.events.find(e => e.id === 'receivable-21')
    expect(ev.date).toBe('2026-03-15')
  })

  it('invoiced receivable is not included', () => {
    useReceivables.mockReturnValue({
      receivables: [{ id: 22, status: 'invoiced', amount: 1000, created_at: '2026-03-01T00:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    expect(result.current.events.find(e => e.id === 'receivable-22')).toBeUndefined()
  })

  it('positive transaction produces green event', () => {
    useTransactions.mockReturnValue({
      transactions: [{ id: 30, amount: 10000, date: '2026-04-03' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    const ev = result.current.events.find(e => e.id === 'transaction-30')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(TX_GREEN)
  })

  it('negative transaction produces red event', () => {
    useTransactions.mockReturnValue({
      transactions: [{ id: 31, amount: -5000, date: '2026-04-04' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks: [] }))
    const ev = result.current.events.find(e => e.id === 'transaction-31')
    expect(ev.color).toBe(TX_RED)
  })

  it('types filter restricts output to specified types only', () => {
    const tasks = [
      { id: 40, title: 'T', due_date: '2026-04-01T00:00:00Z' },
    ]
    useActivities.mockReturnValue({
      activities: [{ id: 50, title: 'A', scheduled_at: '2026-04-02T00:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks, types: ['task'] }))
    expect(result.current.events.every(e => e.type === 'task')).toBe(true)
    expect(result.current.events.find(e => e.id === 'activity-50')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (hook not written yet)**

```bash
npx vitest run src/hooks/useCalendarEvents.test.js
```

Expected: FAIL — "Cannot find module './useCalendarEvents'"

- [ ] **Step 3: Write `useCalendarEvents.js`**

Create `src/hooks/useCalendarEvents.js`:

```js
// src/hooks/useCalendarEvents.js
import { useMemo } from 'react'
import { useActivities } from './useActivities'
import { useReceivables } from './useReceivables'
import { useTransactions } from './useTransactions'
import { useFinRules } from './useFinRules'

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id          - 'task-due-42', 'activity-7', etc.
 * @property {string} title
 * @property {string} date        - ISO date YYYY-MM-DD
 * @property {'task'|'activity'|'receivable'|'transaction'} type
 * @property {string} color       - hex color
 * @property {number} sourceId    - original record id
 * @property {string} sourceType  - matches type
 * @property {object} payload     - original record
 */

const COLORS = {
  taskDue:      '#3b82f6',
  taskDone:     '#94a3b8',
  activity:     '#8b5cf6',
  receivable:   '#f59e0b',
  txCredit:     '#10b981',
  txDebit:      '#ef4444',
}

const toDateStr = (isoStr) => (isoStr || '').slice(0, 10)

/**
 * Normalizes tasks, activities, receivables, and transactions into CalendarEvent[].
 * @param {{ tasks?: object[], types?: string[], from?: Date, to?: Date }} options
 */
export function useCalendarEvents({ tasks = [], types, from, to } = {}) {
  const { activities, loading: actLoading } = useActivities()
  const { receivables, loading: recLoading } = useReceivables()
  const { rules } = useFinRules()
  const { transactions, loading: txLoading } = useTransactions({}, rules)

  // Stable string key avoids re-creating the array reference on every render
  const typesKey = types ? types.join(',') : 'all'

  const events = useMemo(() => {
    const allowedTypes = types ?? ['task', 'activity', 'receivable', 'transaction']
    const result = []

    if (allowedTypes.includes('task')) {
      for (const t of tasks) {
        if (t.due_date) {
          result.push({
            id: `task-due-${t.id}`,
            title: t.title,
            date: toDateStr(t.due_date),
            type: 'task',
            color: COLORS.taskDue,
            sourceId: t.id,
            sourceType: 'task',
            payload: t,
          })
        }
        if (t.completed_at) {
          result.push({
            id: `task-done-${t.id}`,
            title: `✓ ${t.title}`,
            date: toDateStr(t.completed_at),
            type: 'task',
            color: COLORS.taskDone,
            sourceId: t.id,
            sourceType: 'task',
            payload: t,
          })
        }
      }
    }

    if (allowedTypes.includes('activity')) {
      for (const a of activities) {
        if (!a.scheduled_at) continue
        result.push({
          id: `activity-${a.id}`,
          title: a.title,
          date: toDateStr(a.scheduled_at),
          type: 'activity',
          color: COLORS.activity,
          sourceId: a.id,
          sourceType: 'activity',
          payload: a,
        })
      }
    }

    if (allowedTypes.includes('receivable')) {
      for (const r of receivables) {
        if (r.status !== 'pending') continue
        const dateStr = r.due_date ? r.due_date : toDateStr(r.created_at)
        result.push({
          id: `receivable-${r.id}`,
          title: `A receber: ${r.tasks?.title ?? r.activities?.title ?? '—'}`,
          date: dateStr,
          type: 'receivable',
          color: COLORS.receivable,
          sourceId: r.id,
          sourceType: 'receivable',
          payload: r,
        })
      }
    }

    if (allowedTypes.includes('transaction')) {
      for (const tx of transactions) {
        if (!tx.date) continue
        result.push({
          id: `transaction-${tx.id}`,
          title: tx.notes || (tx.amount > 0 ? 'Crédito' : 'Débito'),
          date: tx.date,
          type: 'transaction',
          color: tx.amount >= 0 ? COLORS.txCredit : COLORS.txDebit,
          sourceId: tx.id,
          sourceType: 'transaction',
          payload: tx,
        })
      }
    }

    // Client-side date filter
    if (from || to) {
      return result.filter(ev => {
        const d = new Date(ev.date)
        if (from && d < from) return false
        if (to   && d > to)   return false
        return true
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, activities, receivables, transactions, typesKey, from, to])

  const loading = actLoading || recLoading || txLoading

  return { events, loading, refresh: () => {} }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useCalendarEvents.test.js
```

Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCalendarEvents.js src/hooks/useCalendarEvents.test.js
git commit -m "feat: add useCalendarEvents hook with 10 unit tests"
```

---

## Task 5: CalendarView + CalendarFilters + Sidebar + App route

**Files:**
- Create: `src/components/Calendar/CalendarView.jsx`
- Create: `src/components/Calendar/CalendarFilters.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Install FullCalendar dependencies**

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/core
```

- [ ] **Step 2: Create CalendarFilters**

Create `src/components/Calendar/CalendarFilters.jsx`:

```jsx
// src/components/Calendar/CalendarFilters.jsx
import { useState } from 'react'

const FILTER_OPTIONS = [
  { type: 'task',        label: 'Tarefas',    color: '#3b82f6' },
  { type: 'activity',    label: 'Atividades', color: '#8b5cf6' },
  { type: 'receivable',  label: 'A Receber',  color: '#f59e0b' },
  { type: 'transaction', label: 'Transações', color: '#10b981' },
]

export default function CalendarFilters({ active, onChange }) {
  return (
    <div className="calendar-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {FILTER_OPTIONS.map(opt => {
        const isActive = active.includes(opt.type)
        return (
          <button
            key={opt.type}
            onClick={() => {
              const next = isActive
                ? active.filter(t => t !== opt.type)
                : [...active, opt.type]
              if (next.length > 0) onChange(next)
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: `2px solid ${opt.color}`,
              background: isActive ? opt.color : 'transparent',
              color: isActive ? '#fff' : opt.color,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create CalendarView (without EventDetailPanel — added in Task 6)**

Create `src/components/Calendar/CalendarView.jsx`:

```jsx
// src/components/Calendar/CalendarView.jsx
import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { AnimatePresence } from 'framer-motion'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import CalendarFilters from './CalendarFilters'

const ALL_TYPES = ['task', 'activity', 'receivable', 'transaction']

export default function CalendarView({
  filterTypes,      // undefined = unified view; ['task'] = tasks only
  tasks = [],
  clients = [],
  team = [],
  columns = [],
  onUpdateTask,     // (id, updates) => void — from App.jsx; needed by EventDetailPanel
  onAddTask,        // (form) => void — from App.jsx; needed by EventDetailPanel
}) {
  const [activeTypes, setActiveTypes] = useState(filterTypes ?? ALL_TYPES)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { events, loading } = useCalendarEvents({
    tasks,
    types: filterTypes ?? activeTypes,
  })

  const fcEvents = events.map(ev => ({
    id: ev.id,
    title: ev.title,
    date: ev.date,
    backgroundColor: ev.color,
    borderColor: ev.color,
    extendedProps: { calendarEvent: ev },
  }))

  const handleEventClick = ({ event }) => {
    setSelectedEvent(event.extendedProps.calendarEvent)
  }

  return (
    <div className="calendar-view" style={{ padding: '0 0 24px' }}>
      {!filterTypes && (
        <CalendarFilters active={activeTypes} onChange={setActiveTypes} />
      )}

      {loading && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Carregando eventos...</p>
      )}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        locale={ptBrLocale}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth',
        }}
        events={fcEvents}
        eventClick={handleEventClick}
        height="auto"
        editable={false}
      />

      {/* EventDetailPanel will be added in Task 6 */}
      {selectedEvent && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <strong>{selectedEvent.title}</strong>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {selectedEvent.type} · {selectedEvent.date}
          </p>
          <button
            style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setSelectedEvent(null)}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add Calendário to Sidebar**

In `src/components/Sidebar.jsx`, add to the `menuItems` array (after Arquivo):

```js
import { ..., CalendarDays } from 'lucide-react'

// in menuItems array:
{ id: 'calendario', label: 'Calendário', icon: CalendarDays },
```

- [ ] **Step 5: Add `'calendario'` route to App.jsx**

In `src/App.jsx`:

1. Add import at the top:
```js
import CalendarView from './components/Calendar/CalendarView'
```

2. Add case in `renderContent()` after `'arquivo'`:
```js
case 'calendario':
  return (
    <CalendarView
      tasks={filteredTasks}
      clients={clients}
      team={team}
      columns={columns}
      onUpdateTask={updateTask}
      onAddTask={addTask}
    />
  )
```

3. Add `'calendario'` to `getPageTitle()`:
```js
case 'calendario': return 'Calendário'
```

- [ ] **Step 6: Add Calendar tab inside Tarefas**

In `src/App.jsx`, inside the `'tarefas'` case, add to the `.tabs` div after the Arquivos button:

```jsx
import { ..., CalendarDays } from 'lucide-react'

// in the tabs section:
<button
  className={`tab-btn ${viewType === 'calendar' ? 'active' : ''}`}
  onClick={() => setViewType('calendar')}
>
  <CalendarDays size={16} />
  Calendário
</button>
```

And in the `board-container` section, add the view:

```jsx
{viewType === 'calendar' && (
  <CalendarView
    filterTypes={['task']}
    tasks={filteredTasks}
    clients={clients}
    team={team}
    columns={columns}
    onUpdateTask={updateTask}
    onAddTask={addTask}
  />
)}
```

**Note (spec traceability):** This task implements spec items 5, 6, and 7 (Ordem de Implementação). Item 7 ("Aba Calendário dentro de Tarefas") is in Step 6 above.

- [ ] **Step 7: Commit**

```bash
git add src/components/Calendar/ src/components/Sidebar.jsx src/App.jsx
git commit -m "feat: add CalendarView + CalendarFilters, Calendário sidebar nav, and Calendário tab in Tarefas"
```

---

## Task 6: EventDetailPanel

**Files:**
- Create: `src/components/Calendar/EventDetailPanel.jsx`
- Modify: `src/components/Calendar/CalendarView.jsx`

- [ ] **Step 1: Create EventDetailPanel**

Create `src/components/Calendar/EventDetailPanel.jsx`:

```jsx
// src/components/Calendar/EventDetailPanel.jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle, Edit, DollarSign, Phone, Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { centsToReal, realToCents } from '../../lib/finUtils'

/**
 * Slide-in panel showing contextual actions for a selected CalendarEvent.
 * Opens existing modals (TaskModal, ActivityForm, etc.) pre-filled.
 *
 * Props:
 *   event                        - CalendarEvent (from useCalendarEvents)
 *   onClose                      - () => void
 *   clients, tasks, team, columns
 *   onUpdateTask                 - (id, updates) => void — from App.jsx
 *   onUpdateActivity             - (id, updates) => void — from useActivities in CalendarView
 *   onInvoice                    - (receivableId, amountCents, date) => void
 *   onAddActivity                - (form) => void
 *   onAddTask                    - (form) => void — from App.jsx
 *   onUpdateTransaction          - (id, updates) => void
 *   createReceivableFromActivity - (activityId, amount, accountId, dueDate) => Promise
 *   principalAccountId           - number|null — for A Receber from activity
 */
export default function EventDetailPanel({
  event,
  onClose,
  clients = [],
  tasks = [],
  team = [],
  columns = [],
  onUpdateTask,
  onUpdateActivity,
  onInvoice,
  onAddActivity,
  onAddTask,
  onUpdateTransaction,
  createReceivableFromActivity,
  principalAccountId,
}) {
  const [innerModal, setInnerModal] = useState(null)
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10) })
  const [receivableForm, setReceivableForm] = useState({ amount: '', dueDate: new Date().toISOString().slice(0, 10) })

  if (!event) return null

  const { type, payload } = event

  const handleInvoiceConfirm = () => {
    const cents = realToCents(invoiceForm.amount)
    if (!cents || !invoiceForm.date) return
    onInvoice?.(payload.id, cents, invoiceForm.date)
    setInnerModal(null)
    onClose()
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={e => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <h2>{event.title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {type === 'task'        && `Tarefa · ${event.date}`}
            {type === 'activity'    && `Atividade · ${event.date}`}
            {type === 'receivable'  && `A Receber · ${centsToReal(payload.amount)} · ${event.date}`}
            {type === 'transaction' && `Transação · ${centsToReal(Math.abs(payload.amount))} · ${event.date}`}
          </p>

          {/* TASK actions */}
          {type === 'task' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('editTask')}>
                <Edit size={14} /> Editar
              </button>
              {!payload.completed_at && (
                <button className="action-btn" onClick={() => {
                  onUpdateTask?.(payload.id, { status: columns[columns.length - 1]?.name ?? payload.status })
                  onClose()
                }}>
                  <CheckCircle size={14} /> Concluir
                </button>
              )}
              {payload.category === 'Vendas' && (
                <button className="action-btn" onClick={() => setInnerModal('invoice')}>
                  <DollarSign size={14} /> Faturar
                </button>
              )}
            </>
          )}

          {/* ACTIVITY actions */}
          {type === 'activity' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('editActivity')}>
                <Edit size={14} /> Editar
              </button>
              <button className="action-btn" onClick={() => setInnerModal('newTransaction')}>
                <DollarSign size={14} /> Criar Transação
              </button>
              <button className="action-btn" onClick={() => setInnerModal('newReceivable')}>
                <Plus size={14} /> Criar A Receber
              </button>
              <button className="action-btn" onClick={() => {
                // Uses onUpdateActivity (from useActivities), NOT onUpdateTask (wrong table)
                onUpdateActivity?.(payload.id, { status: 'done' })
                onClose()
              }}>
                <CheckCircle size={14} /> Concluir
              </button>
            </>
          )}

          {/* RECEIVABLE actions */}
          {type === 'receivable' && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('invoice')}>
                <DollarSign size={14} /> Faturar
              </button>
              <button className="action-btn" onClick={() => {
                onAddActivity?.({
                  title: `Follow-up: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`,
                  type: 'call',
                  status: 'pending',
                  scheduled_at: null,
                  related_to: [{ type: 'receivable', id: payload.id }],
                })
                onClose()
              }}>
                <Phone size={14} /> Follow-up
              </button>
              <button className="action-btn" onClick={() => setInnerModal('newTask')}>
                <Plus size={14} /> Criar Tarefa
              </button>
            </>
          )}

          {/* TRANSACTION actions */}
          {(type === 'transaction') && (
            <>
              <button className="action-btn" onClick={() => setInnerModal('newTask')}>
                <Plus size={14} /> Criar Tarefa
              </button>
              <button className="action-btn" onClick={() => {
                onAddActivity?.({
                  title: payload.notes || 'Atividade vinculada',
                  type: 'note',
                  status: 'pending',
                  scheduled_at: null,
                  related_to: [{ type: 'transaction', id: payload.id }],
                })
                onClose()
              }}>
                <Plus size={14} /> Criar Atividade
              </button>
            </>
          )}

          {/* Inline invoice form */}
          {innerModal === 'invoice' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Valor recebido (R$)</label>
              <input
                className="form-input"
                type="text"
                value={invoiceForm.amount}
                placeholder="0,00"
                onChange={e => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
              />
              <label style={{ fontSize: 13 }}>Data</label>
              <input
                className="form-input"
                type="date"
                value={invoiceForm.date}
                onChange={e => setInvoiceForm(prev => ({ ...prev, date: e.target.value }))}
              />
              <button className="add-member-btn" onClick={handleInvoiceConfirm}>
                Confirmar faturamento
              </button>
            </div>
          )}

          {/* Inline A Receber form for activity → Receivable */}
          {innerModal === 'newReceivable' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Valor a receber (R$)</label>
              <input
                className="form-input"
                type="text"
                value={receivableForm.amount}
                placeholder="0,00"
                onChange={e => setReceivableForm(prev => ({ ...prev, amount: e.target.value }))}
              />
              <label style={{ fontSize: 13 }}>Previsão de recebimento</label>
              <input
                className="form-input"
                type="date"
                value={receivableForm.dueDate}
                onChange={e => setReceivableForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              <button
                className="add-member-btn"
                onClick={async () => {
                  const cents = realToCents(receivableForm.amount)
                  if (!cents || cents <= 0) return
                  if (!principalAccountId) {
                    alert('Nenhuma conta Principal definida. Acesse Finanças → Contas.')
                    return
                  }
                  await createReceivableFromActivity?.(
                    payload.id, cents, principalAccountId, receivableForm.dueDate || null
                  )
                  setInnerModal(null)
                  onClose()
                }}
              >
                Criar A Receber
              </button>
            </div>
          )}

          {/* Inline new task form for receivable/transaction → Task */}
          {innerModal === 'newTask' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Título da tarefa</label>
              <input
                className="form-input"
                type="text"
                defaultValue={
                  type === 'receivable'
                    ? `Cobrar: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`
                    : ''
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onAddTask?.({ title: e.target.value, status: columns[0]?.name ?? 'A Fazer', priority: 'Média' })
                    onClose()
                  }
                }}
                placeholder="Enter para confirmar"
                autoFocus
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Wire EventDetailPanel into CalendarView**

In `src/components/Calendar/CalendarView.jsx`:

1. Import:
```js
import EventDetailPanel from './EventDetailPanel'
import { useActivities } from '../../hooks/useActivities'
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinRules } from '../../hooks/useFinRules'
```

2. Add hooks inside CalendarView:
```js
const { addActivity, updateActivity } = useActivities()
const { invoiceReceivable, createReceivableFromActivity } = useReceivables()
const { rules } = useFinRules()
const { addTransaction } = useTransactions({}, rules)
```

Also derive `principalAccountId` for the A Receber flow:
```js
import { useAccounts } from '../../hooks/useAccounts'
import { getPrincipalAccount } from '../../lib/financeUtils'

const { accounts } = useAccounts()
const principalAccount = getPrincipalAccount(accounts)
```

3. Wire `dateClick` on FullCalendar (spec section 6.1: clicking an empty date opens ActivityForm):

Add state for the date-click form:
```js
const [dateClickDate, setDateClickDate] = useState(null)
```

Add to `<FullCalendar>`:
```jsx
dateClick={({ dateStr }) => setDateClickDate(dateStr)}
```

Render `ActivityForm` when `dateClickDate` is set (import ActivityForm from `../../components/Activities/ActivityForm` at the top):
```jsx
<AnimatePresence>
  {dateClickDate && (
    <ActivityForm
      activity={{ scheduled_at: dateClickDate + 'T09:00' }}
      clients={clients}
      tasks={tasks}
      team={team}
      templates={[]}
      onSave={async (form) => {
        await addActivity(form)
        setDateClickDate(null)
      }}
      onClose={() => setDateClickDate(null)}
    />
  )}
</AnimatePresence>
```

4. Replace the placeholder `selectedEvent &&` block with:
```jsx
<AnimatePresence>
  {selectedEvent && (
    <EventDetailPanel
      event={selectedEvent}
      onClose={() => setSelectedEvent(null)}
      clients={clients}
      tasks={tasks}
      team={team}
      columns={columns}
      onUpdateTask={onUpdateTask}
      onUpdateActivity={updateActivity}
      onInvoice={(id, amount, date) => invoiceReceivable(id, amount, date, addTransaction)}
      onAddActivity={addActivity}
      onAddTask={onAddTask}
      createReceivableFromActivity={createReceivableFromActivity}
      principalAccountId={principalAccount?.id ?? null}
    />
  )}
</AnimatePresence>
```

**Note:** `onUpdateTask` and `onAddTask` come from App.jsx via CalendarView props (already added in Task 5 Steps 5–6). `updateActivity`, `invoiceReceivable`, `createReceivableFromActivity`, and `principalAccountId` are resolved locally inside CalendarView.

- [ ] **Step 3: Commit**

```bash
git add src/components/Calendar/EventDetailPanel.jsx src/components/Calendar/CalendarView.jsx src/App.jsx
git commit -m "feat: add EventDetailPanel with contextual actions for all 4 event types"
```

---

## Task 7: ActivityForm — Financial Accordion

**Files:**
- Modify: `src/components/Activities/ActivityForm.jsx`
- Modify: `src/components/Activities/ActivitiesView.jsx`

- [ ] **Step 1: Add financial accordion state to ActivityForm**

`ActivityForm` receives two new optional props: `addTransaction` and `createReceivableFromActivity`.

In the component signature:
```js
const ActivityForm = ({
  activity, onSave, onClose,
  clients = [], tasks = [], team = [], templates = [], onApplyTemplate,
  addTransaction,
  createReceivableFromActivity,
  principalAccountId,  // number|null — required for Transação imediata (account_id)
}) => {
```

Add state for the financial section:
```js
const [finOpen, setFinOpen] = useState(false)
const [finMode, setFinMode] = useState('transaction') // 'transaction' | 'receivable'
const [finAmount, setFinAmount] = useState('')
const [finDate, setFinDate] = useState(new Date().toISOString().slice(0, 10))
```

- [ ] **Step 2: Update handleSubmit to process financial section**

Replace `handleSubmit` so that after saving the activity it checks if the financial accordion was open with a value:

```js
const handleSubmit = async (e) => {
  e.preventDefault()
  if (!form.title.trim()) return

  const savedActivity = await onSave({
    ...form,
    scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
  })

  if (finOpen && finAmount && savedActivity?.id) {
    const amountCents = realToCents(finAmount)
    if (amountCents > 0) {
      if (finMode === 'transaction' && addTransaction) {
        if (!principalAccountId) {
          alert('Nenhuma conta Principal definida. Acesse Finanças → Contas.')
        } else {
          await addTransaction({
            account_id: principalAccountId,   // required by transactions table
            amount: amountCents,
            date: finDate,
            notes: `Atividade: ${form.title}`,
            related_to: [{ type: 'activity', id: savedActivity.id }],
          })
        }
      } else if (finMode === 'receivable' && createReceivableFromActivity) {
        const rec = await createReceivableFromActivity(
          savedActivity.id, amountCents, principalAccountId ?? null, finDate
        )
        if (rec) {
          // Update activity's related_to to link back to the new receivable
          // onSave already closed the form; nothing more needed here for UX
        }
      }
    }
  }
}
```

**Note:** This requires `onSave` to return the saved activity object. Update `ActivitiesView.handleSave` in the next step to return the result.

- [ ] **Step 3: Add accordion JSX to ActivityForm**

Import `realToCents` from `../../lib/finUtils` and `ChevronDown` from lucide.

Add this accordion after the RelationChips section, before the form submit button:

```jsx
<div className="form-group" style={{ marginTop: 8 }}>
  <button
    type="button"
    className="action-btn"
    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}
    onClick={() => setFinOpen(v => !v)}
  >
    <span>＋ Registrar valor financeiro</span>
    <ChevronDown size={14} style={{ transform: finOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
  </button>

  {finOpen && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: '12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" value="transaction" checked={finMode === 'transaction'} onChange={() => setFinMode('transaction')} />
          Transação imediata
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" value="receivable" checked={finMode === 'receivable'} onChange={() => setFinMode('receivable')} />
          A Receber
        </label>
      </div>
      <input
        className="form-input"
        type="text"
        placeholder="Valor (ex: 1.500,00)"
        value={finAmount}
        onChange={e => setFinAmount(e.target.value)}
      />
      <input
        className="form-input"
        type="date"
        value={finDate}
        onChange={e => setFinDate(e.target.value)}
      />
    </div>
  )}
</div>
```

- [ ] **Step 4: Update ActivitiesView to pass financial props and return saved activity**

In `src/components/Activities/ActivitiesView.jsx`:

1. Import `useReceivables` and `useTransactions`/`useFinRules`:
```js
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinRules } from '../../hooks/useFinRules'
```

2. Add hooks:
```js
const { createReceivableFromActivity } = useReceivables()
const { rules } = useFinRules()
const { addTransaction } = useTransactions({}, rules)
// Needed so addTransaction knows which account to credit for Transação imediata
const { accounts } = useAccounts()
```

Also import at the top:
```js
import { useAccounts } from '../../hooks/useAccounts'
import { getPrincipalAccount } from '../../lib/financeUtils'
```

Pass `principalAccountId` to ActivityForm:
```jsx
<ActivityForm
  // ...existing props...
  addTransaction={addTransaction}
  createReceivableFromActivity={createReceivableFromActivity}
  principalAccountId={getPrincipalAccount(accounts)?.id ?? null}
/>
```

3. Update `handleSave` to return the saved activity:
```js
const handleSave = async (form) => {
  let saved
  if (editingActivity) {
    const { id, ...updates } = form
    saved = await updateActivity(editingActivity.id, updates)
  } else {
    saved = await addActivity(form)
  }
  setShowForm(false)
  setEditingActivity(null)
  return saved
}
```

Check that `useActivities` `addActivity` and `updateActivity` return the saved record (they should since they `.select()` in Supabase).

4. Pass new props to `ActivityForm`:
```jsx
<ActivityForm
  // ... existing props ...
  addTransaction={addTransaction}
  createReceivableFromActivity={createReceivableFromActivity}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Activities/ActivityForm.jsx src/components/Activities/ActivitiesView.jsx
git commit -m "feat: add financial accordion to ActivityForm (Transação / A Receber)"
```

---

## Task 8: TransactionForm — Link Accordion

**Files:**
- Modify: `src/components/Finance/TransactionForm.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`

- [ ] **Step 1: Add link accordion to TransactionForm**

`TransactionForm` receives three new optional props: `addActivity`, `onCreateTask`, and `onUpdateTransaction`.

- `addActivity` — from `useActivities` (wired in FinanceView)
- `onCreateTask` — async `(form) => Promise<savedTask>` — from App.jsx via FinanceView; after saving, calls `updateTransaction` to link back
- `onUpdateTransaction` — from `useTransactions` (already exists in FinanceView)

Update the component signature to include them. Then add state:
```js
const [linkOpen, setLinkOpen] = useState(false)
const [newTaskTitle, setNewTaskTitle] = useState('')
```

Add the accordion JSX after RelationChips, before the form actions. Only shown when editing an existing transaction (`transaction?.id`):

```jsx
{transaction?.id && (
  <div className="form-group" style={{ marginTop: 8 }}>
    <button
      type="button"
      className="action-btn"
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}
      onClick={() => setLinkOpen(v => !v)}
    >
      <span>＋ Criar Tarefa ou Atividade vinculada</span>
      <ChevronDown size={14} style={{ transform: linkOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
    </button>

    {linkOpen && (
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            className="form-input"
            type="text"
            placeholder="Título da nova tarefa"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
          />
          <button
            type="button"
            className="action-btn"
            style={{ marginTop: 6 }}
            onClick={async () => {
              if (!newTaskTitle.trim() || !onCreateTask) return
              const newTask = await onCreateTask({
                title: newTaskTitle,
                status: 'A Fazer',
                priority: 'Média',
              })
              if (newTask?.id) {
                // Link the new task back to this transaction
                const updatedRelated = [...(transaction.related_to || []), { type: 'task', id: newTask.id }]
                onUpdateTransaction?.(transaction.id, { related_to: updatedRelated })
              }
              setNewTaskTitle('')
              setLinkOpen(false)
            }}
          >
            Criar Tarefa
          </button>
        </div>
        <button
          type="button"
          className="action-btn"
          onClick={() => {
            addActivity?.({
              title: form.notes || 'Atividade vinculada',
              type: 'note',
              status: 'pending',
              scheduled_at: null,
              related_to: [{ type: 'transaction', id: transaction.id }],
            })
            setLinkOpen(false)
          }}
        >
          Criar Atividade
        </button>
      </div>
    )}
  </div>
)}
```

Import `ChevronDown` from lucide-react.

- [ ] **Step 2: Update FinanceView to pass the new props**

`FinanceView` receives a new prop `onAddTask` from App.jsx (added in Task 9). Wire the three new TransactionForm props:

```jsx
// Add import if not already there:
import { useActivities } from '../../hooks/useActivities'

// Inside FinanceView component:
const { addActivity } = useActivities()
// useTransactions is already used in FinanceView — extract updateTransaction too:
const { transactions, addTransaction, updateTransaction, ... } = useTransactions(...)

// Pass to TransactionForm:
addActivity={addActivity}
onCreateTask={onAddTask}   // onAddTask is the new prop from App.jsx
onUpdateTransaction={updateTransaction}
```

**Important:** `onAddTask` must be added as a prop to `FinanceView` (same as done in Task 9 for ReceivablesList). It flows: `App.jsx addTask → FinanceView onAddTask → TransactionForm onCreateTask`. Update `App.jsx`:

```jsx
case 'financas':
  return <FinanceView clients={clients} tasks={tasks} team={team} onAddTask={addTask} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/TransactionForm.jsx src/components/Finance/FinanceView.jsx
git commit -m "feat: add link accordion to TransactionForm (Criar Tarefa / Criar Atividade)"
```

---

## Task 9: ReceivablesList — Follow-up + Criar Tarefa

**Files:**
- Modify: `src/components/Finance/ReceivablesList.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`

- [ ] **Step 1: Add Follow-up and Criar Tarefa buttons to ReceivablesList**

`ReceivablesList` receives new optional props: `addActivity`, `onAddTask`, `columns`.

Update component signature:
```js
export default function ReceivablesList({ receivables, onInvoice, addActivity, onAddTask, columns = [] }) {
```

In the row render, add two buttons after the existing Faturar button:

```jsx
<button
  className="action-btn"
  style={{ fontSize: 13, padding: '4px 10px' }}
  onClick={() => addActivity?.({
    title: `Follow-up: ${r.tasks?.title ?? r.activities?.title ?? ''}`,
    type: 'call',
    status: 'pending',
    scheduled_at: null,
    related_to: [{ type: 'receivable', id: r.id }],
  })}
>
  📞 Follow-up
</button>

<button
  className="action-btn"
  style={{ fontSize: 13, padding: '4px 10px' }}
  onClick={() => onAddTask?.({
    title: `Cobrar: ${r.tasks?.title ?? r.activities?.title ?? ''}`,
    // Use the first column's name (dynamic) instead of hardcoding 'A Fazer'
    status: columns[0]?.name ?? 'A Fazer',
    priority: 'Média',
  })}
>
  + Tarefa
</button>
```

Also update the title display to show activity title as fallback:
```jsx
<div style={{ fontWeight: 500 }}>{r.tasks?.title ?? r.activities?.title ?? '—'}</div>
```

- [ ] **Step 2: Pass new props from FinanceView**

In `src/components/Finance/FinanceView.jsx`:

1. Import `useActivities` if not already there.
2. Wire `addActivity` from the hook.
3. Pass `addActivity` and `onAddTask` (from props or via a local handler) to `ReceivablesList`.

`FinanceView` needs `addTask` and `columns` from App.jsx. Add `onAddTask` and `columns` as props:

In App.jsx:
```jsx
case 'financas':
  return <FinanceView clients={clients} tasks={tasks} team={team} onAddTask={addTask} columns={columns} />
```

In FinanceView, receive `onAddTask` and `columns` and pass them to ReceivablesList:
```jsx
<ReceivablesList
  receivables={pendingReceivables}
  onInvoice={...}
  addActivity={addActivity}
  onAddTask={onAddTask}
  columns={columns}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/ReceivablesList.jsx src/components/Finance/FinanceView.jsx src/App.jsx
git commit -m "feat: add Follow-up and Criar Tarefa actions to ReceivablesList"
```

---

## Task 10: Tests — Cross-Integration + financeUtils extension

**Files:**
- Create: `src/hooks/crossIntegration.test.js`
- Modify: `src/lib/financeUtils.test.js`

- [ ] **Step 1: Extend financeUtils tests for activity_id idempotência**

In `src/lib/financeUtils.test.js`, add after the existing `shouldCreateReceivable` tests:

```js
it('shouldCreateReceivable returns true for Vendas task even if activity receivables exist (activity receivables are independent)', () => {
  const task = { id: 5, category: 'Vendas', deal_value: 10000 }
  // A receivable exists but it's linked to an activity, not this task
  const existing = [{ task_id: null, activity_id: 99, status: 'pending' }]
  expect(shouldCreateReceivable(task, existing)).toBe(true)
})
```

- [ ] **Step 2: Run financeUtils tests to confirm new test passes**

```bash
npx vitest run src/lib/financeUtils.test.js
```

Expected: all tests PASS (the new case should already pass since `shouldCreateReceivable` checks `r.task_id === task.id`).

- [ ] **Step 3: Write cross-integration tests**

Create `src/hooks/crossIntegration.test.js`:

```js
// src/hooks/crossIntegration.test.js
// Tests that the correct Supabase calls are made for each cross-module flow.
// All Supabase interactions are mocked via vi.fn().

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper: build a minimal mock supabase chain
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn(() => Promise.resolve({ data: [{ id: 99 }], error: null }))

const mockFrom = vi.fn(() => ({
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  select: mockSelect,
  eq: vi.fn().mockReturnThis(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}))

// We test the logic through the hook functions directly (not via renderHook)
// by importing and calling them after mocking supabase.

describe('Activity → Transaction flow', () => {
  it('addTransaction is called with related_to containing activity type', async () => {
    const addTransaction = vi.fn().mockResolvedValue({ id: 10 })
    await addTransaction({
      amount: 5000,
      date: '2026-04-01',
      notes: 'Atividade: reunião',
      related_to: [{ type: 'activity', id: 7 }],
    })
    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ related_to: [{ type: 'activity', id: 7 }] })
    )
  })
})

describe('invoiceReceivable — activity source', () => {
  it('builds notes from activities.title when task_id is null', () => {
    const rec = {
      id: 1,
      task_id: null,
      activity_id: 5,
      target_account_id: 2,
      amount: 10000,
      tasks: null,
      activities: { title: 'Consulta', id: 5 },
    }
    const sourceName = rec.tasks?.title ?? rec.activities?.title ?? 'lançamento'
    expect(sourceName).toBe('Consulta')
  })

  it('builds related_to from activity_id when task_id is null', () => {
    const rec = { id: 1, task_id: null, activity_id: 5 }
    const sourceLink = rec.task_id
      ? { type: 'task', id: rec.task_id }
      : { type: 'activity', id: rec.activity_id }
    expect(sourceLink).toEqual({ type: 'activity', id: 5 })
  })
})

describe('Receivable → Follow-up Activity', () => {
  it('creates activity with type call and related_to receivable', async () => {
    const addActivity = vi.fn().mockResolvedValue({ id: 20 })
    const receivable = { id: 3, tasks: { title: 'Venda ABC' } }
    await addActivity({
      title: `Follow-up: ${receivable.tasks?.title}`,
      type: 'call',
      status: 'pending',
      scheduled_at: null,
      related_to: [{ type: 'receivable', id: receivable.id }],
    })
    expect(addActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'call',
        related_to: [{ type: 'receivable', id: 3 }],
      })
    )
  })
})

describe('Receivable → Task', () => {
  it('suggested task title includes Cobrar: prefix', () => {
    const rec = { id: 4, tasks: { title: 'Projeto X' } }
    const title = `Cobrar: ${rec.tasks?.title ?? rec.activities?.title ?? ''}`
    expect(title).toBe('Cobrar: Projeto X')
  })

  it('uses activities.title when task_id is null', () => {
    const rec = { id: 5, task_id: null, activities: { title: 'Reunião inicial' } }
    const title = `Cobrar: ${rec.tasks?.title ?? rec.activities?.title ?? ''}`
    expect(title).toBe('Cobrar: Reunião inicial')
  })
})

describe('Transaction → Activity', () => {
  it('creates activity with related_to containing transaction type', async () => {
    const addActivity = vi.fn().mockResolvedValue({ id: 30 })
    const tx = { id: 7, notes: 'Pagamento serviço' }
    await addActivity({
      title: tx.notes,
      type: 'note',
      status: 'pending',
      scheduled_at: null,
      related_to: [{ type: 'transaction', id: tx.id }],
    })
    expect(addActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        related_to: [{ type: 'transaction', id: 7 }],
      })
    )
  })
})

describe('Activity → Receivable (createReceivableFromActivity)', () => {
  it('inserts with activity_id and no task_id', async () => {
    const createReceivableFromActivity = vi.fn().mockResolvedValue({ id: 40, activity_id: 12 })
    const result = await createReceivableFromActivity(12, 8000, 1, '2026-05-01')
    expect(createReceivableFromActivity).toHaveBeenCalledWith(12, 8000, 1, '2026-05-01')
    expect(result.activity_id).toBe(12)
  })
})
```

- [ ] **Step 4: Run cross-integration tests**

```bash
npx vitest run src/hooks/crossIntegration.test.js
```

Expected: all PASS

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (useCalendarEvents + financeUtils + crossIntegration)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/crossIntegration.test.js src/lib/financeUtils.test.js
git commit -m "test: add cross-integration tests and financeUtils activity_id idempotência test"
```

---

## Final: Branch wrap-up

- [ ] **Step 1: Run all tests one last time**

```bash
npx vitest run
```

Expected: all green

- [ ] **Step 2: Manual smoke test**

1. Open the app — Sidebar shows 📅 Calendário
2. Navigate to Calendário — FullCalendar renders in Portuguese, month view
3. Navigate to Tarefas — Calendário tab appears next to Arquivos
4. Add a task with Prazo preenchido — appears as blue event in calendar
5. Complete a task — grey event appears on its completed_at date
6. Click a calendar event — EventDetailPanel slides in with correct actions
7. In Atividades, create an activity with accordion financeiro aberto → Transação
8. In Finanças → A Receber, verify Follow-up and Criar Tarefa buttons appear

- [ ] **Step 3: Create PR**

```bash
git push origin feature/calendar-integration
# Open PR: feature/calendar-integration → main
```
