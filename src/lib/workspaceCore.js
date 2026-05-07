import { authenticatedFetch } from './apiFetch.js'
import { getRequiredActiveTenantId } from './activeTenant.js'

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

export async function workspaceCoreRequest(path, { method = 'GET', body, query, fallbackMessage, tenantId } = {}) {
  const resolvedTenantId = tenantId ?? getRequiredActiveTenantId()
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

export async function fetchWorkspaceBootstrap() {
  return request('/bootstrap', { fallbackMessage: 'Erro ao carregar o espaço de trabalho' })
}

export async function createTaskRecord(task) {
  return request('/tasks', {
    method: 'POST',
    body: task,
    fallbackMessage: 'Erro ao criar tarefa',
  })
}

export async function updateTaskRecord(id, updates) {
  return request(`/tasks/${id}`, {
    method: 'PATCH',
    body: updates,
    fallbackMessage: 'Erro ao atualizar tarefa',
  })
}

export async function deleteTaskRecord(id) {
  return request(`/tasks/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir tarefa' })
}

export async function archiveTaskRecord(id) {
  return request(`/tasks/${id}/archive`, { method: 'POST', fallbackMessage: 'Erro ao arquivar tarefa' })
}

export async function restoreTaskRecord(id) {
  return request(`/tasks/${id}/restore`, { method: 'POST', fallbackMessage: 'Erro ao restaurar tarefa' })
}

export async function listArchivedTaskRecords(filters = {}) {
  return request('/tasks/archived', {
    query: filters,
    fallbackMessage: 'Erro ao listar tarefas arquivadas',
  })
}

export async function createColumnRecord(column) {
  return request('/columns', {
    method: 'POST',
    body: column,
    fallbackMessage: 'Erro ao criar coluna',
  })
}

export async function deleteColumnRecord(id) {
  return request(`/columns/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir coluna' })
}

export async function saveTeamMemberRecord(member) {
  const hasId = Boolean(member?.id)
  return request(hasId ? `/team/${member.id}` : '/team', {
    method: hasId ? 'PATCH' : 'POST',
    body: member,
    fallbackMessage: 'Erro ao salvar membro',
  })
}

export async function deleteTeamMemberRecord(id) {
  return request(`/team/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir membro' })
}

export async function saveClientRecord(client) {
  const hasId = Boolean(client?.id)
  return request(hasId ? `/clients/${client.id}` : '/clients', {
    method: hasId ? 'PATCH' : 'POST',
    body: client,
    fallbackMessage: 'Erro ao salvar cliente',
  })
}

export async function deleteClientRecord(id) {
  return request(`/clients/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir cliente' })
}

export async function listActivityRecords() {
  return request('/activities', { fallbackMessage: 'Erro ao carregar atividades' })
}

export async function saveActivityRecord(activity) {
  const hasId = Boolean(activity?.id)
  return request(hasId ? `/activities/${activity.id}` : '/activities', {
    method: hasId ? 'PATCH' : 'POST',
    body: activity,
    fallbackMessage: 'Erro ao salvar atividade',
  })
}

export async function deleteActivityRecord(id) {
  return request(`/activities/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir atividade' })
}

export async function listActivityTemplateRecords() {
  return request('/activity-templates', { fallbackMessage: 'Erro ao carregar modelos de atividade' })
}

export async function saveActivityTemplateRecord(template) {
  const hasId = Boolean(template?.id)
  return request(hasId ? `/activity-templates/${template.id}` : '/activity-templates', {
    method: hasId ? 'PATCH' : 'POST',
    body: template,
    fallbackMessage: 'Erro ao salvar modelo de atividade',
  })
}

export async function deleteActivityTemplateRecord(id) {
  return request(`/activity-templates/${id}`, {
    method: 'DELETE',
    fallbackMessage: 'Erro ao excluir modelo de atividade',
  })
}

export async function listReceivableRecords() {
  return request('/receivables', { fallbackMessage: 'Erro ao carregar recebíveis' })
}

export async function createReceivableRecord(receivable) {
  return request('/receivables', {
    method: 'POST',
    body: receivable,
    fallbackMessage: 'Erro ao criar recebível',
  })
}

export async function updateReceivableRecord(id, updates) {
  return request(`/receivables/${id}`, {
    method: 'PATCH',
    body: updates,
    fallbackMessage: 'Erro ao atualizar recebível',
  })
}

export async function listAccountRecords() {
  return request('/accounts', { fallbackMessage: 'Erro ao carregar contas' })
}

export async function saveAccountRecord(account) {
  const hasId = Boolean(account?.id)
  return request(hasId ? `/accounts/${account.id}` : '/accounts', {
    method: hasId ? 'PATCH' : 'POST',
    body: account,
    fallbackMessage: 'Erro ao salvar conta',
  })
}

export async function listActiveAccounts() {
  return request('/accounts/active', { fallbackMessage: 'Erro ao listar contas ativas' })
}

export async function listPayeeRecords() {
  return request('/payees', { fallbackMessage: 'Erro ao carregar favorecidos' })
}

export async function savePayeeRecord(payee) {
  const hasId = Boolean(payee?.id)
  return request(hasId ? `/payees/${payee.id}` : '/payees', {
    method: hasId ? 'PATCH' : 'POST',
    body: payee,
    fallbackMessage: 'Erro ao salvar favorecido',
  })
}

export async function listFinRuleRecords() {
  return request('/fin-rules', { fallbackMessage: 'Erro ao carregar regras financeiras' })
}

export async function saveFinRuleRecord(rule) {
  const hasId = Boolean(rule?.id)
  return request(hasId ? `/fin-rules/${rule.id}` : '/fin-rules', {
    method: hasId ? 'PATCH' : 'POST',
    body: rule,
    fallbackMessage: 'Erro ao salvar regra financeira',
  })
}

export async function deleteFinRuleRecord(id) {
  return request(`/fin-rules/${id}`, { method: 'DELETE', fallbackMessage: 'Erro ao excluir regra financeira' })
}

export async function listFinCategoryRecords() {
  return request('/fin-categories', { fallbackMessage: 'Erro ao carregar categorias financeiras' })
}

export async function createCategoryGroupRecord(group) {
  return request('/fin-categories/groups', {
    method: 'POST',
    body: group,
    fallbackMessage: 'Erro ao criar grupo de categoria',
  })
}

export async function saveFinCategoryRecord(category) {
  const hasId = Boolean(category?.id)
  return request(hasId ? `/fin-categories/items/${category.id}` : '/fin-categories/items', {
    method: hasId ? 'PATCH' : 'POST',
    body: category,
    fallbackMessage: 'Erro ao salvar categoria financeira',
  })
}

export async function listTransactionRecords(filters = {}) {
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
    fallbackMessage: 'Erro ao carregar transações',
  })
}

export async function createTransactionRecord(transaction) {
  return request('/transactions', {
    method: 'POST',
    body: transaction,
    fallbackMessage: 'Erro ao criar transação',
  })
}

export async function updateTransactionRecord(id, updates) {
  return request(`/transactions/${id}`, {
    method: 'PATCH',
    body: updates,
    fallbackMessage: 'Erro ao atualizar transação',
  })
}

export async function deleteTransactionRecord(id) {
  return request(`/transactions/${id}`, {
    method: 'DELETE',
    fallbackMessage: 'Erro ao excluir transação',
  })
}

export async function listInteractionLogRecords(clientId) {
  return request('/interaction-logs', {
    query: { clientId },
    fallbackMessage: 'Erro ao carregar histórico de interações',
  })
}

export async function createInteractionLogRecord(log) {
  return request('/interaction-logs', {
    method: 'POST',
    body: log,
    fallbackMessage: 'Erro ao criar interação',
  })
}
