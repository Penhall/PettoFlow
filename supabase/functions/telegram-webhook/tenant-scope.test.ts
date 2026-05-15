import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { recordTransaction } from './actions/finance.ts'
import { listTasks } from './actions/tasks.ts'
import { requestConfirmation, getPendingConfirmation } from './utils/confirm.ts'
import { executeActions } from './utils/actions.ts'
import { resolveBotConfigFromWebhookSecret } from './utils/config.ts'
import { sha256Hex } from '../_shared/hash.ts'

type QueryRecord = {
  table: string
  op: string
  payload?: unknown
  filters: Array<{ method: string; args: unknown[] }>
}

class QueryBuilder {
  private op = 'select'
  filters: Array<{ method: string; args: unknown[] }> = []
  payload?: unknown

  constructor(
    private sb: FakeSupabase,
    private table: string,
  ) {}

  select() {
    this.op = 'select'
    return this
  }

  insert(payload: unknown) {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  update(payload: unknown) {
    this.op = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args })
    return this
  }

  is(...args: unknown[]) {
    this.filters.push({ method: 'is', args })
    return this
  }

  not(...args: unknown[]) {
    this.filters.push({ method: 'not', args })
    return this
  }

  order(...args: unknown[]) {
    this.filters.push({ method: 'order', args })
    return this
  }

  limit(...args: unknown[]) {
    this.filters.push({ method: 'limit', args })
    return this
  }

  single() {
    this.filters.push({ method: 'single', args: [] })
    return this
  }

  maybeSingle() {
    this.filters.push({ method: 'maybeSingle', args: [] })
    return this
  }

  then(resolve: (value: unknown) => void, reject: (reason?: unknown) => void) {
    this.sb.records.push({
      table: this.table,
      op: this.op,
      payload: this.payload,
      filters: this.filters,
    })
    Promise.resolve(this.sb.nextResponse(this.table, this.op)).then(resolve, reject)
  }
}

class FakeSupabase {
  records: QueryRecord[] = []
  private responses = new Map<string, unknown[]>()

  from(table: string) {
    return new QueryBuilder(this, table)
  }

  queue(table: string, op: string, response: unknown) {
    const key = `${table}:${op}`
    this.responses.set(key, [...(this.responses.get(key) ?? []), response])
  }

  nextResponse(table: string, op: string) {
    const key = `${table}:${op}`
    const queued = this.responses.get(key) ?? []
    if (queued.length > 0) {
      const [next, ...rest] = queued
      this.responses.set(key, rest)
      return next
    }
    return op === 'select' ? { data: [], error: null } : { error: null }
  }
}

function hasTenantFilter(record: QueryRecord, tenantId = 'tenant-a') {
  return record.filters.some((filter) => (
    filter.method === 'eq'
    && filter.args[0] === 'tenant_id'
    && filter.args[1] === tenantId
  ))
}

Deno.test('finance persistence scopes account lookup and transaction insert by tenant', async () => {
  const sb = new FakeSupabase()
  sb.queue('accounts', 'select', { data: [{ id: 7, category: 'principal' }], error: null })
  sb.queue('transactions', 'insert', { error: null })

  await recordTransaction(sb as never, 'tenant-a', 'out', 'almoço', 42)

  const accountLookup = sb.records.find((record) => record.table === 'accounts' && record.op === 'select')
  const insert = sb.records.find((record) => record.table === 'transactions' && record.op === 'insert')

  assert(accountLookup)
  assert(insert)
  assert(hasTenantFilter(accountLookup))
  assertEquals((insert.payload as Record<string, unknown>).tenant_id, 'tenant-a')
})

Deno.test('task list stores confirmation context under tenant and chat', async () => {
  const sb = new FakeSupabase()
  sb.queue('kanban_columns', 'select', {
    data: [{ name: 'A Fazer' }, { name: 'Concluído' }],
    error: null,
  })
  sb.queue('tasks', 'select', {
    data: [{ id: 1, title: 'Enviar proposta', status: 'A Fazer', priority: 'Alta' }],
    error: null,
  })

  await listTasks(sb as never, 'tenant-a', 'chat-1')

  const taskRead = sb.records.find((record) => record.table === 'tasks' && record.op === 'select')
  const contextDelete = sb.records.find((record) => record.table === 'bot_pending_confirmations' && record.op === 'delete')
  const contextInsert = sb.records.find((record) => record.table === 'bot_pending_confirmations' && record.op === 'insert')

  assert(taskRead)
  assert(contextDelete)
  assert(contextInsert)
  assert(hasTenantFilter(taskRead))
  assert(hasTenantFilter(contextDelete))
  assertEquals((contextInsert.payload as Record<string, unknown>).tenant_id, 'tenant-a')
  assertEquals((contextInsert.payload as Record<string, unknown>).chat_id, 'chat-1')
})

Deno.test('confirmation lifecycle is tenant scoped', async () => {
  const sb = new FakeSupabase()
  sb.queue('bot_pending_confirmations', 'select', {
    data: {
      action_type: 'finance.record',
      action_payload: { amount: 100 },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    },
    error: null,
  })

  await requestConfirmation(sb as never, 'tenant-a', 'chat-1', 'finance.record', { amount: 100 }, 'Confirmar?')
  const pending = await getPendingConfirmation(sb as never, 'tenant-a', 'chat-1')

  const records = sb.records.filter((record) => record.table === 'bot_pending_confirmations')
  assertEquals(pending?.action_type, 'finance.record')
  assert(records.every((record) => (
    record.op === 'insert'
      ? (record.payload as Record<string, unknown>).tenant_id === 'tenant-a'
      : hasTenantFilter(record)
  )))
})

Deno.test('custom command execution forwards tenant id into each action', async () => {
  const sb = new FakeSupabase()
  sb.queue('kanban_columns', 'select', { data: [], error: null })
  sb.queue('tasks', 'insert', { error: null })
  sb.queue('activities', 'insert', { error: null })

  await executeActions(sb as never, 'tenant-a', 'chat-1', [
    { action: 'tasks.create', params: { title: 'Preparar pauta' } },
    { action: 'activities.log', params: { type: 'note', text: 'Resumo' } },
  ])

  const inserts = sb.records.filter((record) => record.op === 'insert')
  assertEquals(inserts.map((record) => (record.payload as Record<string, unknown>).tenant_id), ['tenant-a', 'tenant-a'])
})

Deno.test('webhook config resolution maps secret hash to one tenant config', async () => {
  const sb = new FakeSupabase()
  const secretHash = await sha256Hex('telegram-secret')
  sb.queue('bot_configs', 'select', {
    data: {
      id: 'config-a',
      tenant_id: 'tenant-a',
      webhook_secret_sha256: secretHash,
      telegram_bot_token: 'encrypted-token',
      webhook_secret: 'encrypted-secret',
      allowed_telegram_ids: [],
      is_active: true,
      confirmation_threshold: 500,
    },
    error: null,
  })

  const config = await resolveBotConfigFromWebhookSecret(sb as never, 'telegram-secret', 'key')
  const lookup = sb.records.find((record) => record.table === 'bot_configs' && record.op === 'select')

  assertEquals(config?.tenant_id, 'tenant-a')
  assert(lookup?.filters.some((filter) => (
    filter.method === 'eq'
    && filter.args[0] === 'webhook_secret_sha256'
    && filter.args[1] === secretHash
  )))
})

Deno.test('getPendingConfirmation expiry does not delete task_list_context records', async () => {
  const sb = new FakeSupabase()
  sb.queue('bot_pending_confirmations', 'select', {
    data: {
      action_type: 'finance.record',
      action_payload: { amount: 100 },
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    },
    error: null,
  })

  const pending = await getPendingConfirmation(sb as never, 'tenant-a', 'chat-1')

  assertEquals(pending, null)

  const deletes = sb.records.filter(
    (record) => record.table === 'bot_pending_confirmations' && record.op === 'delete'
  )
  assert(deletes.length > 0)
  for (const del of deletes) {
    const hasTaskListContextFilter = del.filters.some(
      (f) => f.method === 'not' && f.args[0] === 'action_type' && f.args[1] === 'eq' && f.args[2] === 'task_list_context'
    )
    assert(hasTaskListContextFilter, `delete on ${del.table} must exclude task_list_context`)
  }
})
