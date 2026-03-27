// src/hooks/useCalendarEvents.test.js
// @vitest-environment jsdom
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

  it('task without due_date or completed_at falls back to created_at (blue)', () => {
    const tasks = [{ id: 3, title: 'T3', created_at: '2026-03-15T08:00:00Z' }]
    const { result } = renderHook(() => useCalendarEvents({ tasks }))
    const ev = result.current.events.find(e => e.id === 'task-3')
    expect(ev).toBeDefined()
    expect(ev.color).toBe(TASK_BLUE)
    expect(ev.date).toBe('2026-03-15')
  })

  it('task without due_date or completed_at or created_at is not included', () => {
    const tasks = [{ id: 4, title: 'T4' }]
    const { result } = renderHook(() => useCalendarEvents({ tasks }))
    expect(result.current.events.filter(e => e.sourceId === 4 && e.sourceType === 'task')).toHaveLength(0)
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
    const tasks = [{ id: 40, title: 'T', due_date: '2026-04-01T00:00:00Z' }]
    useActivities.mockReturnValue({
      activities: [{ id: 50, title: 'A', scheduled_at: '2026-04-02T00:00:00Z' }],
      loading: false,
    })
    const { result } = renderHook(() => useCalendarEvents({ tasks, types: ['task'] }))
    expect(result.current.events.every(e => e.type === 'task')).toBe(true)
    expect(result.current.events.find(e => e.id === 'activity-50')).toBeUndefined()
  })
})
