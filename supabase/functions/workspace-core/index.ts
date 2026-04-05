import { json, preflight } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'
import { requireWorkspaceAccess, workspaceAuthError } from '../_shared/workspace-auth.ts'

function parseId(segment: string | null) {
  if (!segment) return null
  const id = Number(segment)
  return Number.isInteger(id) && id > 0 ? id : null
}

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function pickFields(value: unknown, allowedFields: string[]) {
  const source = toRecord(value)
  return Object.fromEntries(
    allowedFields
      .filter((field) => hasOwn(source, field))
      .map((field) => [field, source[field]]),
  )
}

function parseOptionalPositiveInt(value: string | null, label: string) {
  if (value === null || value === '') return { value: null, error: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { value: null, error: `${label} invalido` }
  }
  return { value: parsed, error: null }
}

function parseOptionalBoolean(value: string | null, label: string) {
  if (value === null || value === '') return { value: null, error: null }
  if (value === 'true') return { value: true, error: null }
  if (value === 'false') return { value: false, error: null }
  return { value: null, error: `${label} invalido` }
}

function parsePageNumber(value: string | null, fallback: number, label: string) {
  if (value === null || value === '') return { value: fallback, error: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: fallback, error: `${label} invalido` }
  }
  return { value: parsed, error: null }
}

function parsePageSize(value: string | null, fallback: number, label: string) {
  if (value === null || value === '') return { value: fallback, error: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    return { value: fallback, error: `${label} invalido` }
  }
  return { value: parsed, error: null }
}

function getRouteParts(req: Request) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf('workspace-core')
  return {
    url,
    routeParts: index >= 0 ? parts.slice(index + 1) : [],
  }
}

function getRange(page: number, pageSize: number) {
  const from = page * pageSize
  const to = from + pageSize - 1
  return { from, to }
}

const TASK_CREATE_FIELDS = ['title', 'status', 'priority', 'owner', 'tags', 'progress', 'deal_value', 'client_id', 'category', 'due_date', 'created_at', 'completed_at']
const TASK_UPDATE_FIELDS = ['title', 'status', 'priority', 'owner', 'tags', 'progress', 'deal_value', 'client_id', 'category', 'due_date', 'completed_at']
const COLUMN_FIELDS = ['name', 'order_index']
const TEAM_FIELDS = ['name', 'role', 'email', 'phone', 'status']
const CLIENT_FIELDS = ['name', 'industry', 'projects', 'revenue', 'status', 'email', 'phone', 'company_size']
const ACTIVITY_FIELDS = ['title', 'type', 'body', 'status', 'created_by', 'related_to', 'scheduled_at']
const ACTIVITY_TEMPLATE_FIELDS = ['name', 'type', 'default_notes', 'default_assigned_to', 'tags']
const ACCOUNT_FIELDS = ['name', 'type', 'category', 'opening_balance', 'is_active']
const PAYEE_FIELDS = ['name']
const FIN_RULE_FIELDS = ['name', 'conditions', 'actions', 'priority', 'is_active']
const CATEGORY_GROUP_FIELDS = ['name', 'sort_order', 'is_income']
const FIN_CATEGORY_FIELDS = ['name', 'group_id', 'sort_order', 'hidden']
const TRANSACTION_FIELDS = ['account_id', 'amount', 'date', 'payee_id', 'category_id', 'notes', 'related_to', 'cleared', 'needs_review']
const RECEIVABLE_CREATE_FIELDS = ['task_id', 'activity_id', 'amount', 'target_account_id', 'status', 'due_date']
const RECEIVABLE_UPDATE_FIELDS = ['amount', 'target_account_id', 'status', 'due_date', 'transaction_id', 'invoiced_at']
const INTERACTION_LOG_FIELDS = ['client_id', 'type', 'notes']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req, 'GET, POST, PATCH, DELETE, OPTIONS')
  if (!requireWorkspaceAccess(req)) return workspaceAuthError(req)

  const sb = getSupabaseClient()
  const { url, routeParts } = getRouteParts(req)
  const resource = routeParts[0] ?? null
  const resourceId = routeParts[1] ?? null
  const action = routeParts[2] ?? null

  try {
    if (req.method === 'GET' && resource === 'bootstrap') {
      const [tasksResult, teamResult, clientsResult, columnsResult] = await Promise.all([
        sb.from('tasks').select('*').is('archived_at', null).order('created_at', { ascending: false }),
        sb.from('team').select('*').order('id'),
        sb.from('clients').select('*').order('name'),
        sb.from('kanban_columns').select('*').order('order_index'),
      ])

      if (tasksResult.error) return json(req, { error: tasksResult.error.message }, 500)
      if (teamResult.error) return json(req, { error: teamResult.error.message }, 500)
      if (clientsResult.error) return json(req, { error: clientsResult.error.message }, 500)
      if (columnsResult.error) return json(req, { error: columnsResult.error.message }, 500)

      return json(req, {
        tasks: tasksResult.data ?? [],
        team: teamResult.data ?? [],
        clients: clientsResult.data ?? [],
        columns: columnsResult.data ?? [],
      })
    }

    if (req.method === 'GET' && resource === 'tasks' && resourceId === 'archived') {
      const parsedPage = parsePageNumber(url.searchParams.get('page'), 0, 'page')
      if (parsedPage.error) return json(req, { error: parsedPage.error }, 400)
      const parsedPageSize = parsePageSize(url.searchParams.get('pageSize'), 50, 'pageSize')
      if (parsedPageSize.error) return json(req, { error: parsedPageSize.error }, 400)

      const category = url.searchParams.get('category') ?? ''
      const tag = url.searchParams.get('tag') ?? ''
      const dateFrom = url.searchParams.get('dateFrom') ?? ''
      const dateTo = url.searchParams.get('dateTo') ?? ''
      const { from, to } = getRange(parsedPage.value, parsedPageSize.value)

      let query = sb
        .from('tasks')
        .select('*', { count: 'exact' })
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .range(from, to)

      if (category) query = query.eq('category', category)
      if (tag) query = query.contains('tags', [tag])
      if (dateFrom) query = query.gte('archived_at', dateFrom)
      if (dateTo) query = query.lte('archived_at', `${dateTo}T23:59:59`)

      const { data, error, count } = await query
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { items: data ?? [], totalCount: count ?? 0 })
    }

    if (req.method === 'POST' && resource === 'tasks' && !resourceId) {
      const body = pickFields(await req.json(), TASK_CREATE_FIELDS)
      const { data, error } = await sb.from('tasks').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'tasks' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Task id invalido' }, 400)
      const body = pickFields(await req.json(), TASK_UPDATE_FIELDS)
      const { data, error } = await sb.from('tasks').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'tasks' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Task id invalido' }, 400)
      const { error } = await sb.from('tasks').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'POST' && resource === 'tasks' && resourceId && action === 'archive') {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Task id invalido' }, 400)
      const { error } = await sb.from('tasks').update({ archived_at: new Date().toISOString() }).eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'POST' && resource === 'tasks' && resourceId && action === 'restore') {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Task id invalido' }, 400)
      const { data, error } = await sb.from('tasks').update({ archived_at: null }).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'POST' && resource === 'columns' && !resourceId) {
      const body = pickFields(await req.json(), COLUMN_FIELDS)
      const { data, error } = await sb.from('kanban_columns').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'DELETE' && resource === 'columns' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Column id invalido' }, 400)
      const { error } = await sb.from('kanban_columns').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'POST' && resource === 'team' && !resourceId) {
      const body = pickFields(await req.json(), TEAM_FIELDS)
      const { data, error } = await sb.from('team').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'team' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Team id invalido' }, 400)
      const body = pickFields(await req.json(), TEAM_FIELDS)
      const { data, error } = await sb.from('team').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'team' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Team id invalido' }, 400)
      const { error } = await sb.from('team').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'POST' && resource === 'clients' && !resourceId) {
      const body = pickFields(await req.json(), CLIENT_FIELDS)
      const { data, error } = await sb.from('clients').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'clients' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Client id invalido' }, 400)
      const body = pickFields(await req.json(), CLIENT_FIELDS)
      const { data, error } = await sb.from('clients').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'clients' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Client id invalido' }, 400)
      const { error } = await sb.from('clients').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'GET' && resource === 'activities' && !resourceId) {
      const { data, error } = await sb.from('activities').select('*').order('created_at', { ascending: false })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'activities' && !resourceId) {
      const body = pickFields(await req.json(), ACTIVITY_FIELDS)
      const { data, error } = await sb.from('activities').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'activities' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Activity id invalido' }, 400)
      const body = pickFields(await req.json(), ACTIVITY_FIELDS)
      const { data, error } = await sb.from('activities').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'activities' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Activity id invalido' }, 400)
      const { error } = await sb.from('activities').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'GET' && resource === 'activity-templates' && !resourceId) {
      const { data, error } = await sb.from('activity_templates').select('*').order('name')
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'activity-templates' && !resourceId) {
      const body = pickFields(await req.json(), ACTIVITY_TEMPLATE_FIELDS)
      const { data, error } = await sb.from('activity_templates').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'activity-templates' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Template id invalido' }, 400)
      const body = pickFields(await req.json(), ACTIVITY_TEMPLATE_FIELDS)
      const { data, error } = await sb.from('activity_templates').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'activity-templates' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Template id invalido' }, 400)
      const { error } = await sb.from('activity_templates').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'GET' && resource === 'accounts' && !resourceId) {
      const { data, error } = await sb.from('accounts').select('*').order('sort_order', { ascending: true })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'GET' && resource === 'accounts' && resourceId === 'active') {
      const { data, error } = await sb.from('accounts').select('*').eq('is_active', true)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'accounts' && !resourceId) {
      const body = pickFields(await req.json(), ACCOUNT_FIELDS)
      const { data, error } = await sb.from('accounts').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'accounts' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Account id invalido' }, 400)
      const body = pickFields(await req.json(), ACCOUNT_FIELDS)
      const { data, error } = await sb.from('accounts').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'GET' && resource === 'payees' && !resourceId) {
      const { data, error } = await sb.from('payees').select('*').order('name', { ascending: true })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'payees' && !resourceId) {
      const body = pickFields(await req.json(), PAYEE_FIELDS)
      const { data, error } = await sb.from('payees').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'payees' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Payee id invalido' }, 400)
      const body = pickFields(await req.json(), PAYEE_FIELDS)
      const { data, error } = await sb.from('payees').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'GET' && resource === 'fin-rules' && !resourceId) {
      const { data, error } = await sb.from('fin_rules').select('*').order('priority', { ascending: true })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'fin-rules' && !resourceId) {
      const body = pickFields(await req.json(), FIN_RULE_FIELDS)
      const { data, error } = await sb.from('fin_rules').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'fin-rules' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Rule id invalido' }, 400)
      const body = pickFields(await req.json(), FIN_RULE_FIELDS)
      const { data, error } = await sb.from('fin_rules').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'fin-rules' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Rule id invalido' }, 400)
      const { error } = await sb.from('fin_rules').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'GET' && resource === 'fin-categories' && !resourceId) {
      const [groupsRes, catsRes] = await Promise.all([
        sb.from('category_groups').select('*').order('sort_order'),
        sb.from('fin_categories').select('*').order('sort_order'),
      ])
      if (groupsRes.error) return json(req, { error: groupsRes.error.message }, 500)
      if (catsRes.error) return json(req, { error: catsRes.error.message }, 500)
      return json(req, { groups: groupsRes.data ?? [], categories: catsRes.data ?? [] })
    }

    if (req.method === 'POST' && resource === 'fin-categories' && resourceId === 'groups') {
      const body = pickFields(await req.json(), CATEGORY_GROUP_FIELDS)
      const { data, error } = await sb.from('category_groups').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'POST' && resource === 'fin-categories' && resourceId === 'items') {
      const body = pickFields(await req.json(), FIN_CATEGORY_FIELDS)
      const { data, error } = await sb.from('fin_categories').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'fin-categories' && resourceId === 'items' && action) {
      const id = parseId(action)
      if (!id) return json(req, { error: 'Category id invalido' }, 400)
      const body = pickFields(await req.json(), FIN_CATEGORY_FIELDS)
      const { data, error } = await sb.from('fin_categories').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'GET' && resource === 'transactions' && !resourceId) {
      let query = sb.from('transactions').select('*')
      const accountId = parseOptionalPositiveInt(url.searchParams.get('accountId'), 'accountId')
      if (accountId.error) return json(req, { error: accountId.error }, 400)
      const categoryId = parseOptionalPositiveInt(url.searchParams.get('categoryId'), 'categoryId')
      if (categoryId.error) return json(req, { error: categoryId.error }, 400)
      const needsReview = parseOptionalBoolean(url.searchParams.get('needsReview'), 'needsReview')
      if (needsReview.error) return json(req, { error: needsReview.error }, 400)
      const cleared = parseOptionalBoolean(url.searchParams.get('cleared'), 'cleared')
      if (cleared.error) return json(req, { error: cleared.error }, 400)
      const relatedType = url.searchParams.get('relatedType')
      const relatedId = parseOptionalPositiveInt(url.searchParams.get('relatedId'), 'relatedId')
      if (relatedId.error) return json(req, { error: relatedId.error }, 400)
      const dateFrom = url.searchParams.get('dateFrom')
      const dateTo = url.searchParams.get('dateTo')
      const onlyNegative = url.searchParams.get('onlyNegative')

      if (accountId.value) query = query.eq('account_id', accountId.value)
      if (categoryId.value) query = query.eq('category_id', categoryId.value)
      if (dateFrom) query = query.gte('date', dateFrom)
      if (dateTo) query = query.lte('date', dateTo)
      if (needsReview.value !== null) query = query.eq('needs_review', needsReview.value)
      if (cleared.value !== null) query = query.eq('cleared', cleared.value)

      if (onlyNegative) {
        if (onlyNegative !== 'true') return json(req, { error: 'onlyNegative invalido' }, 400)
        query = query.lt('amount', 0)
      }

      if (relatedType && relatedId.value) {
        query = query.contains('related_to', [{ type: relatedType, id: relatedId.value }])
      } else if (relatedType || relatedId.value) {
        return json(req, { error: 'relatedType e relatedId sao obrigatorios juntos' }, 400)
      }

      const { data, error } = await query.order('date', { ascending: false })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'transactions' && !resourceId) {
      const body = pickFields(await req.json(), TRANSACTION_FIELDS)
      const { data, error } = await sb.from('transactions').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'transactions' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Transaction id invalido' }, 400)
      const body = pickFields(await req.json(), TRANSACTION_FIELDS)
      const { data, error } = await sb.from('transactions').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'DELETE' && resource === 'transactions' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Transaction id invalido' }, 400)
      const { error } = await sb.from('transactions').delete().eq('id', id)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    if (req.method === 'GET' && resource === 'receivables' && !resourceId) {
      const { data, error } = await sb
        .from('receivables')
        .select(`
          *,
          tasks ( title, category, client_id ),
          activities ( title, id ),
          accounts ( name )
        `)
        .order('created_at', { ascending: false })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'receivables' && !resourceId) {
      const body = pickFields(await req.json(), RECEIVABLE_CREATE_FIELDS)
      const { data, error } = await sb.from('receivables').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && resource === 'receivables' && resourceId) {
      const id = parseId(resourceId)
      if (!id) return json(req, { error: 'Receivable id invalido' }, 400)
      const body = pickFields(await req.json(), RECEIVABLE_UPDATE_FIELDS)
      const { data, error } = await sb.from('receivables').update(body).eq('id', id).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    if (req.method === 'GET' && resource === 'interaction-logs' && !resourceId) {
      const clientId = parseOptionalPositiveInt(url.searchParams.get('clientId'), 'clientId')
      if (clientId.error || !clientId.value) {
        return json(req, { error: clientId.error ?? 'clientId obrigatorio' }, 400)
      }

      const { data, error } = await sb
        .from('interaction_logs')
        .select('*')
        .eq('client_id', clientId.value)
        .order('created_at', { ascending: false })
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && resource === 'interaction-logs' && !resourceId) {
      const body = pickFields(await req.json(), INTERACTION_LOG_FIELDS)
      const { data, error } = await sb.from('interaction_logs').insert([body]).select().single()
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    return json(req, { error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('[workspace-core] unhandled error:', err)
    return json(req, { error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})
