import { authenticatedFetch } from './apiFetch.js'
import { getRequiredActiveTenantId } from './activeTenant.js'
import { isStrictOwnershipMode, traceOwnership } from './diagnostics.js'

const WORKSPACE_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-core`

async function parseResponse(res, fallbackMessage) {
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error ?? fallbackMessage ?? `Erro ${res.status}`)
  }

  return data
}

function buildUrl(path, query = null) {
  const url = new URL(`${WORKSPACE_CORE_URL}${path}`)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

function classifyWorkspaceOperation(path) {
  if (path === '/bootstrap') return 'bootstrap'
  if (path.startsWith('/tasks')) return 'tasks'
  if (path.startsWith('/columns')) return 'columns'
  if (path.startsWith('/team')) return 'team'
  if (path.startsWith('/clients')) return 'clients'
  if (path.startsWith('/activities')) return 'activities'
  if (path.startsWith('/activity-templates')) return 'activity-templates'
  if (path.startsWith('/receivables')) return 'receivables'
  if (path.startsWith('/accounts')) return 'accounts'
  if (path.startsWith('/payees')) return 'payees'
  if (path.startsWith('/fin-rules')) return 'fin-rules'
  if (path.startsWith('/fin-categories')) return 'fin-categories'
  if (path.startsWith('/transactions')) return 'transactions'
  if (path.startsWith('/interaction-logs')) return 'interaction-logs'
  return 'unknown'
}

function captureCallerFrame() {
  const stack = new Error().stack?.split('\n').map((line) => line.trim()) || []
  return stack.find((line) =>
    line &&
    !line.includes('workspaceCoreRequest') &&
    !line.includes('request (') &&
    !line.includes('workspaceCore.js')
  ) ?? null
}

function createStrictOwnershipError(method, path, scope) {
  const error = new Error(`Strict ownership violation: tenantId is required for workspace-core ${method} ${path}.`)
  error.code = 'STRICT_TENANT_OWNERSHIP_REQUIRED'
  error.scope = scope
  return error
}

export async function workspaceCoreRequest(path, { method = 'GET', body, query, fallbackMessage, tenantId } = {}) {
  const scope = classifyWorkspaceOperation(path)
  const usedExplicitTenant = tenantId !== undefined && tenantId !== null && tenantId !== ''
  const caller = !usedExplicitTenant && (isStrictOwnershipMode() || import.meta.env.DEV) ? captureCallerFrame() : null

  let resolvedTenantId = tenantId
  if (!usedExplicitTenant) {
    if (isStrictOwnershipMode()) {
      traceOwnership(`workspace-core ${method} ${path}`, null, 'implicit', {
        scope,
        enforcement: 'throw',
        strictMode: true,
        caller,
      })
      throw createStrictOwnershipError(method, path, scope)
    }

    try {
      resolvedTenantId = getRequiredActiveTenantId()
    } catch (error) {
      traceOwnership(`workspace-core ${method} ${path}`, null, 'implicit', {
        scope,
        enforcement: 'tenant-missing',
        strictMode: false,
        caller,
        errorCode: error?.code ?? null,
      })
      throw error
    }

    traceOwnership(`workspace-core ${method} ${path}`, resolvedTenantId, 'implicit', {
      scope,
      enforcement: 'fallback',
      strictMode: false,
      caller,
    })
  } else {
    traceOwnership(`workspace-core ${method} ${path}`, resolvedTenantId, 'explicit', {
      scope,
    })
  }

  const res = await authenticatedFetch(buildUrl(path, query), {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    tenantId: resolvedTenantId,
    requireTenant: true,
  })
  return parseResponse(res, fallbackMessage ?? `Erro na requisição: ${res.status}`)
}

async function request(path, options = {}) {
  return workspaceCoreRequest(path, options)
}

export async function fetchWorkspaceBootstrap(tenantId) {
  return request('/bootstrap', { tenantId, fallbackMessage: 'Erro ao carregar o espaço de trabalho' })
}

export async function createTaskRecord(task, tenantId) {
  return request('/tasks', { method: 'POST', body: task, tenantId, fallbackMessage: 'Erro ao criar tarefa' })
}

export async function updateTaskRecord(id, updates, tenantId) {
  return request(`/tasks/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar tarefa' })
}

export async function deleteTaskRecord(id, tenantId) {
  return request(`/tasks/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir tarefa' })
}

export async function archiveTaskRecord(id, tenantId) {
  return request(`/tasks/${id}/archive`, { method: 'POST', tenantId, fallbackMessage: 'Erro ao arquivar tarefa' })
}

export async function restoreTaskRecord(id, tenantId) {
  return request(`/tasks/${id}/restore`, { method: 'POST', tenantId, fallbackMessage: 'Erro ao restaurar tarefa' })
}

export async function listArchivedTaskRecords(filters = {}, tenantId) {
  return request('/tasks/archived', { query: filters, tenantId, fallbackMessage: 'Erro ao listar tarefas arquivadas' })
}

export async function createColumnRecord(column, tenantId) {
  return request('/columns', { method: 'POST', body: column, tenantId, fallbackMessage: 'Erro ao criar coluna' })
}

export async function deleteColumnRecord(id, tenantId) {
  return request(`/columns/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir coluna' })
}

export async function saveTeamMemberRecord(member, tenantId) {
  const hasId = Boolean(member?.id)
  return request(hasId ? `/team/${member.id}` : '/team', {
    method: hasId ? 'PATCH' : 'POST',
    body: member,
    tenantId,
    fallbackMessage: 'Erro ao salvar membro',
  })
}

export async function deleteTeamMemberRecord(id, tenantId) {
  return request(`/team/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir membro' })
}

export async function saveClientRecord(client, tenantId) {
  const hasId = Boolean(client?.id)
  return request(hasId ? `/clients/${client.id}` : '/clients', {
    method: hasId ? 'PATCH' : 'POST',
    body: client,
    tenantId,
    fallbackMessage: 'Erro ao salvar cliente',
  })
}

export async function deleteClientRecord(id, tenantId) {
  return request(`/clients/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir cliente' })
}

export async function listActivityRecords(tenantId) {
  return request('/activities', { tenantId, fallbackMessage: 'Erro ao carregar atividades' })
}

export async function saveActivityRecord(activity, tenantId) {
  const hasId = Boolean(activity?.id)
  return request(hasId ? `/activities/${activity.id}` : '/activities', {
    method: hasId ? 'PATCH' : 'POST',
    body: activity,
    tenantId,
    fallbackMessage: 'Erro ao salvar atividade',
  })
}

export async function deleteActivityRecord(id, tenantId) {
  return request(`/activities/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir atividade' })
}

export async function listActivityTemplateRecords(tenantId) {
  return request('/activity-templates', { tenantId, fallbackMessage: 'Erro ao carregar modelos de atividade' })
}

export async function saveActivityTemplateRecord(template, tenantId) {
  const hasId = Boolean(template?.id)
  return request(hasId ? `/activity-templates/${template.id}` : '/activity-templates', {
    method: hasId ? 'PATCH' : 'POST',
    body: template,
    tenantId,
    fallbackMessage: 'Erro ao salvar modelo de atividade',
  })
}

export async function deleteActivityTemplateRecord(id, tenantId) {
  return request(`/activity-templates/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir modelo de atividade' })
}

export async function listReceivableRecords(tenantId) {
  return request('/receivables', { tenantId, fallbackMessage: 'Erro ao carregar recebíveis' })
}

export async function createReceivableRecord(receivable, tenantId) {
  return request('/receivables', { method: 'POST', body: receivable, tenantId, fallbackMessage: 'Erro ao criar recebível' })
}

export async function updateReceivableRecord(id, updates, tenantId) {
  return request(`/receivables/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar recebível' })
}

export async function listAccountRecords(tenantId) {
  return request('/accounts', { tenantId, fallbackMessage: 'Erro ao carregar contas' })
}

export async function saveAccountRecord(account, tenantId) {
  const hasId = Boolean(account?.id)
  return request(hasId ? `/accounts/${account.id}` : '/accounts', {
    method: hasId ? 'PATCH' : 'POST',
    body: account,
    tenantId,
    fallbackMessage: 'Erro ao salvar conta',
  })
}

export async function listActiveAccounts(tenantId) {
  return request('/accounts/active', { tenantId, fallbackMessage: 'Erro ao listar contas ativas' })
}

export async function listPayeeRecords(tenantId) {
  return request('/payees', { tenantId, fallbackMessage: 'Erro ao carregar favorecidos' })
}

export async function savePayeeRecord(payee, tenantId) {
  const hasId = Boolean(payee?.id)
  return request(hasId ? `/payees/${payee.id}` : '/payees', {
    method: hasId ? 'PATCH' : 'POST',
    body: payee,
    tenantId,
    fallbackMessage: 'Erro ao salvar favorecido',
  })
}

export async function listFinRuleRecords(tenantId) {
  return request('/fin-rules', { tenantId, fallbackMessage: 'Erro ao carregar regras financeiras' })
}

export async function saveFinRuleRecord(rule, tenantId) {
  const hasId = Boolean(rule?.id)
  return request(hasId ? `/fin-rules/${rule.id}` : '/fin-rules', {
    method: hasId ? 'PATCH' : 'POST',
    body: rule,
    tenantId,
    fallbackMessage: 'Erro ao salvar regra financeira',
  })
}

export async function deleteFinRuleRecord(id, tenantId) {
  return request(`/fin-rules/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir regra financeira' })
}

export async function listFinCategoryRecords(tenantId) {
  return request('/fin-categories', { tenantId, fallbackMessage: 'Erro ao carregar categorias financeiras' })
}

export async function createCategoryGroupRecord(group, tenantId) {
  return request('/fin-categories/groups', { method: 'POST', body: group, tenantId, fallbackMessage: 'Erro ao criar grupo de categoria' })
}

export async function saveFinCategoryRecord(category, tenantId) {
  const hasId = Boolean(category?.id)
  return request(hasId ? `/fin-categories/items/${category.id}` : '/fin-categories/items', {
    method: hasId ? 'PATCH' : 'POST',
    body: category,
    tenantId,
    fallbackMessage: 'Erro ao salvar categoria financeira',
  })
}

export async function listTransactionRecords(filters = {}, tenantId) {
  const relatedType = filters?.relatedTo?.type
  const relatedId = filters?.relatedTo?.id
  return request('/transactions', {
    query: {
      accountId: filters?.accountId,
      categoryId: filters?.categoryId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      needsReview: filters?.needsReview,
      cleared: filters?.cleared,
      onlyNegative: filters?.onlyNegative,
      relatedType,
      relatedId,
    },
    tenantId,
    fallbackMessage: 'Erro ao carregar transações',
  })
}

export async function createTransactionRecord(transaction, tenantId) {
  return request('/transactions', { method: 'POST', body: transaction, tenantId, fallbackMessage: 'Erro ao criar transação' })
}

export async function updateTransactionRecord(id, updates, tenantId) {
  return request(`/transactions/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar transação' })
}

export async function deleteTransactionRecord(id, tenantId) {
  return request(`/transactions/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir transação' })
}

export async function listInteractionLogRecords(clientId, tenantId) {
  return request('/interaction-logs', { query: { clientId }, tenantId, fallbackMessage: 'Erro ao carregar histórico de interações' })
}

export async function createInteractionLogRecord(log, tenantId) {
  return request('/interaction-logs', { method: 'POST', body: log, tenantId, fallbackMessage: 'Erro ao criar interação' })
}
