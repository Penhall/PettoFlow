import { describe, expect, it, beforeEach } from 'vitest'
import {
  READ_STATES,
  readFailure,
  readStale,
  runReadWithRetry,
} from './readResult.js'
import { getTelemetrySnapshot, resetTelemetry } from './diagnostics.js'

describe('readResult semantics', () => {
  beforeEach(() => {
    resetTelemetry()
  })

  it('classifies unauthorized reads explicitly and hides raw provider messages', () => {
    const error = new Error('JWT expired: provider detail should stay diagnostic-only')
    error.status = 401

    const result = readFailure(error, { operation: 'billing.load' })

    expect(result.ok).toBe(false)
    expect(result.state).toBe(READ_STATES.UNAUTHORIZED)
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toBe('Sua sessão não tem permissão para carregar estes dados.')
    expect(result.error.diagnostics.rawMessage).toContain('JWT expired')
  })

  it('preserves prior data as stale when retry exhaustion fails', async () => {
    const previousData = [{ id: 1, name: 'Conta principal' }]
    let attempts = 0

    const result = await runReadWithRetry('accounts.list', async () => {
      attempts += 1
      throw new Error('Supabase SQL timeout')
    }, {
      retries: 1,
      previousData,
      tenantId: 'tenant-a',
    })

    expect(attempts).toBe(2)
    expect(result.state).toBe(READ_STATES.FAILED)
    expect(result.stale).toBe(true)
    expect(result.data).toBe(previousData)
    expect(result.error.message).toBe('Não foi possível carregar os dados. Tente novamente.')
    expect(getTelemetrySnapshot().read_retries).toBe(1)
    expect(getTelemetrySnapshot().read_stale).toBe(1)
  })

  it('does not retry unauthorized failures', async () => {
    let attempts = 0
    const error = new Error('Forbidden')
    error.status = 403

    const result = await runReadWithRetry('tenant.list', async () => {
      attempts += 1
      throw error
    }, { retries: 2 })

    expect(attempts).toBe(1)
    expect(result.state).toBe(READ_STATES.UNAUTHORIZED)
    expect(getTelemetrySnapshot().read_unauthorized).toBe(1)
  })

  it('marks aborted reads as interrupted and preserves previous data', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('tenant switched', 'AbortError'))

    const result = await runReadWithRetry('workspace.bootstrap', async () => {
      throw new Error('should not run')
    }, {
      signal: controller.signal,
      previousData: { tasks: [{ id: 1 }] },
    })

    expect(result.state).toBe(READ_STATES.INTERRUPTED)
    expect(result.stale).toBe(true)
    expect(result.data.tasks).toHaveLength(1)
    expect(getTelemetrySnapshot().read_interrupted).toBe(1)
  })

  it('represents stale reads without pretending they are fresh success', () => {
    const result = readStale([{ id: 'old' }], { reason: 'tenant-switch' })

    expect(result.ok).toBe(false)
    expect(result.state).toBe(READ_STATES.STALE)
    expect(result.stale).toBe(true)
    expect(result.detail.reason).toBe('tenant-switch')
  })

  it('emits retrying state separately from loading', async () => {
    const states = []
    let attempts = 0

    const result = await runReadWithRetry('commands.list', async () => {
      attempts += 1
      if (attempts === 1) throw new Error('temporary network failure')
      return [{ id: 'cmd' }]
    }, {
      retries: 1,
      onState: (state) => states.push(state.state),
    })

    expect(result.state).toBe(READ_STATES.SUCCESS)
    expect(states).toEqual([
      READ_STATES.LOADING,
      READ_STATES.RETRYING,
      READ_STATES.SUCCESS,
    ])
  })
})
