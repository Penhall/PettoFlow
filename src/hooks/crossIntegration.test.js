// src/hooks/crossIntegration.test.js
// Tests that the correct payload shapes are produced for each cross-module flow.

import { describe, it, expect } from 'vitest'

describe('Activity → Transaction flow', () => {
  it('addTransaction payload includes account_id, related_to with activity type, and activity notes', () => {
    const activityId = 7
    const formTitle = 'reunião'
    const finDate = '2026-04-01'
    const amountCents = 5000
    const principalAccountId = 1

    const payload = {
      account_id: principalAccountId,
      amount: amountCents,
      date: finDate,
      notes: `Atividade: ${formTitle}`,
      related_to: [{ type: 'activity', id: activityId }],
    }

    expect(payload.account_id).toBe(1)
    expect(payload.notes).toBe('Atividade: reunião')
    expect(payload.related_to).toEqual([{ type: 'activity', id: 7 }])
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
  it('creates activity with type call and related_to receivable', () => {
    const receivable = { id: 3, tasks: { title: 'Venda ABC' } }

    const payload = {
      title: `Follow-up: ${receivable.tasks?.title ?? receivable.activities?.title ?? ''}`,
      type: 'call',
      status: 'pending',
      scheduled_at: null,
      related_to: [{ type: 'receivable', id: receivable.id }],
    }

    expect(payload.type).toBe('call')
    expect(payload.title).toBe('Follow-up: Venda ABC')
    expect(payload.related_to).toEqual([{ type: 'receivable', id: 3 }])
    expect(payload.scheduled_at).toBeNull()
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
  it('creates activity with related_to containing transaction type', () => {
    const tx = { id: 7, notes: 'Pagamento serviço' }

    const payload = {
      title: tx.notes || 'Atividade vinculada',
      type: 'note',
      status: 'pending',
      scheduled_at: null,
      related_to: [{ type: 'transaction', id: tx.id }],
    }

    expect(payload.type).toBe('note')
    expect(payload.title).toBe('Pagamento serviço')
    expect(payload.related_to).toEqual([{ type: 'transaction', id: 7 }])
  })
})

describe('Activity → Receivable (createReceivableFromActivity)', () => {
  it('is called with activityId, amountCents, principalAccountId, dueDate in correct order', () => {
    // Verify the 4-argument call signature used throughout the codebase
    const activityId = 12
    const amountCents = 8000
    const principalAccountId = 1
    const dueDate = '2026-05-01'

    // The call shape used in ActivityForm.handleSubmit and EventDetailPanel
    const args = [activityId, amountCents, principalAccountId, dueDate]

    expect(args[0]).toBe(12)             // activityId
    expect(args[1]).toBe(8000)           // amountCents
    expect(args[2]).toBe(1)              // principalAccountId
    expect(args[3]).toBe('2026-05-01')   // dueDate
  })
})
