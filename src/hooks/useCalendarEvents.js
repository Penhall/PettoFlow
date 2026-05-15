// src/hooks/useCalendarEvents.js
import { useMemo } from 'react'
import { useActivities } from './useActivities'
import { useReceivables } from './useReceivables'
import { useTransactions } from './useTransactions'
import { useFinRules } from './useFinRules'

const COLORS = {
  taskDue:    '#3b82f6',
  taskDone:   '#94a3b8',
  activity:   '#8b5cf6',
  receivable: '#f59e0b',
  txCredit:   '#10b981',
  txDebit:    '#ef4444',
}

const toDateStr = (isoStr) => (isoStr || '').slice(0, 10)

/**
 * Normalizes tasks, activities, receivables, and transactions into CalendarEvent[].
 * @param {{ tasks?: object[], types?: string[], from?: Date, to?: Date, tenantId?: string | null }} options
 */
export function useCalendarEvents({ tasks = [], types, from, to, tenantId } = {}) {
  const { activities, loading: actLoading } = useActivities({ tenantId })
  const { receivables, loading: recLoading } = useReceivables({ tenantId })
  const { rules } = useFinRules({ tenantId })
  const { transactions, loading: txLoading } = useTransactions({ filters: {}, rules, tenantId })

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
        } else if (!t.completed_at && t.created_at) {
          // Fallback: tasks without due_date or completion show on their creation date
          result.push({
            id: `task-${t.id}`,
            title: t.title,
            date: toDateStr(t.created_at),
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
        if (to && d > to) return false
        return true
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, activities, receivables, transactions, typesKey, from, to])

  const loading = actLoading || recLoading || txLoading

  return { events, loading, refresh: () => {} }
}
