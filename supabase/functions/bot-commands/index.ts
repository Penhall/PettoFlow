import { json, preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { requireTenantAccess } from '../_shared/tenant.ts'

const DEFAULT_COMMANDS = [
  // Built-in (referência, sem actions)
  { trigger: '/tarefa', description: 'Cria uma nova tarefa', type: 'builtin', actions: [], examples: ['Cria uma tarefa de reunião...', 'Adiciona tarefa para comprar material'], category: 'tasks' },
  { trigger: '/tarefas', description: 'Lista tarefas pendentes', type: 'builtin', actions: [], examples: ['Quais minhas tarefas?', 'Ver tarefas'], category: 'tasks' },
  { trigger: '/ok', description: 'Conclui uma tarefa', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/prioridade', description: 'Define prioridade de tarefa', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/nota', description: 'Registra uma nota', type: 'builtin', actions: [], examples: ['Anota que reunião foi produtiva', 'Registra nota sobre o cliente'], category: 'activities' },
  { trigger: '/reuniao', description: 'Registra uma reunião', type: 'builtin', actions: [], examples: ['Agende uma reunião para amanhã', 'Tive reunião com o cliente'], category: 'activities' },
  { trigger: '/ligacao', description: 'Registra uma ligação', type: 'builtin', actions: [], examples: ['Liguei para o fornecedor', 'Registra ligação com Maria'], category: 'activities' },
  { trigger: '/atividades', description: 'Lista atividades recentes', type: 'builtin', actions: [], examples: ['Minhas atividades', 'O que fiz hoje?'], category: 'activities' },
  { trigger: '/pagar', description: 'Registra uma saída financeira', type: 'builtin', actions: [], examples: ['Paguei R$50 de internet', 'Gastei R$30 com almoço'], category: 'finance' },
  { trigger: '/recebi', description: 'Registra uma entrada financeira', type: 'builtin', actions: [], examples: ['Recebi R$5000 de salário', 'Entrada de R$150 do freelas'], category: 'finance' },
  { trigger: '/saldo', description: 'Consulta saldo das contas', type: 'builtin', actions: [], examples: ['Qual o saldo?', 'Ver saldo'], category: 'finance' },
  { trigger: '/extrato', description: 'Lista últimas transações', type: 'builtin', actions: [], examples: ['Últimas transações', 'Ver extrato'], category: 'finance' },
  // Custom shortcuts
  { trigger: '/cafe', description: 'Saída rápida café', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'café', amount: 8 } }], examples: [], category: 'custom', is_default: true },
  { trigger: '/almoco', description: 'Saída rápida almoço', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'almoço', amount: 35 } }], examples: [], category: 'custom', is_default: true },
  { trigger: '/inicio-do-dia', description: 'Saldo + tarefas ao começar o dia', type: 'multi', actions: [{ action: 'finance.balance', params: {} }, { action: 'tasks.list', params: {} }], examples: [], category: 'custom', is_default: true },
  { trigger: '/fim-de-dia', description: 'Pendências + extrato ao encerrar', type: 'multi', actions: [{ action: 'tasks.list', params: {} }, { action: 'finance.list', params: {} }], examples: [], category: 'custom', is_default: true },
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  const tenant = await requireTenantAccess(req, auth.user.id)
  if (!tenant.ok) return tenant.response
  const tenantId = tenant.tenantId

  const sb = getServiceRoleClient()

  // Find the tenant's bot config.
  const { data: config, error: configError } = await sb
    .from('bot_configs')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (configError) return json(req, { error: 'Erro ao buscar configuracao do bot.' }, 500)

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf('bot-commands')
  const routeParts = index >= 0 ? parts.slice(index + 1) : []
  const resource = routeParts[0] ?? ''

  // GET / — list all commands
  if (req.method === 'GET' && !resource) {
    if (!config) return json(req, { commands: [], categories: [] })

    const { data: commands, error } = await sb
      .from('bot_commands')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bot_config_id', config.id)
      .order('category', { ascending: true })
      .order('is_default', { ascending: false })

    if (error) return json(req, { error: 'Erro ao listar comandos.' }, 500)

    const categories = [...new Set((commands ?? []).map(c => c.category))]
    return json(req, { commands: commands ?? [], categories })
  }

  // POST / — create command
  if (req.method === 'POST' && !resource) {
    if (!config) return json(req, { error: 'Configure o bot primeiro (aba Telegram).' }, 400)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(req, { error: 'JSON invalido.' }, 400)
    }

    const trigger = String(body.trigger || '').trim()
    const description = String(body.description || '').trim()
    const type = String(body.type || '').trim()
    const actions = Array.isArray(body.actions) ? body.actions : []
    const category = String(body.category || 'custom').trim()
    const examples = Array.isArray(body.examples) ? body.examples : []

    if (!trigger) return json(req, { error: 'Trigger obrigatorio.' }, 400)
    if (!description) return json(req, { error: 'Descricao obrigatoria.' }, 400)
    if (!['builtin', 'shortcut', 'template', 'multi'].includes(type)) {
      return json(req, { error: 'Tipo invalido. Use builtin, shortcut, template ou multi.' }, 400)
    }
    if (!['tasks', 'activities', 'finance', 'custom'].includes(category)) {
      return json(req, { error: 'Categoria invalida.' }, 400)
    }

    // Check for duplicate trigger
    const { data: existing } = await sb
      .from('bot_commands')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('bot_config_id', config.id)
      .eq('trigger', trigger)
      .maybeSingle()

    if (existing) {
      return json(req, { error: `Trigger "${trigger}" ja existe.` }, 409)
    }

    const { data: command, error: insertError } = await sb
      .from('bot_commands')
      .insert({
        bot_config_id: config.id,
        tenant_id: tenantId,
        trigger,
        description,
        type,
        actions,
        category,
        examples,
        is_active: true,
        is_default: false,
      })
      .select()
      .single()

    if (insertError) return json(req, { error: 'Erro ao criar comando.' }, 500)

    return json(req, { command })
  }

  // POST /seed — seed default commands
  if (req.method === 'POST' && resource === 'seed') {
    if (!config) return json(req, { error: 'Configure o bot primeiro.' }, 400)

    // Get existing triggers to avoid duplicates
    const { data: existing } = await sb
      .from('bot_commands')
      .select('trigger')
      .eq('tenant_id', tenantId)
      .eq('bot_config_id', config.id)

    const existingTriggers = new Set((existing ?? []).map(c => c.trigger))
    const toInsert = DEFAULT_COMMANDS.filter(c => !existingTriggers.has(c.trigger))

    if (toInsert.length === 0) {
      return json(req, { commands: existing ?? [], seeded: 0 })
    }

    const rows = toInsert.map(cmd => ({
      bot_config_id: config.id,
      tenant_id: tenantId,
      trigger: cmd.trigger,
      description: cmd.description,
      type: cmd.type,
      actions: cmd.actions as Record<string, unknown>[],
      examples: cmd.examples,
      category: cmd.category,
      is_active: true,
      is_default: cmd.is_default ?? true,
    }))

    const { data: inserted, error: insertError } = await sb
      .from('bot_commands')
      .insert(rows)
      .select()

    if (insertError) return json(req, { error: 'Erro ao instalar comandos padrao.' }, 500)

    return json(req, { commands: inserted ?? [], seeded: toInsert.length })
  }

  // PATCH /:id — update command
  if (req.method === 'PATCH' && resource) {
    if (!config) return json(req, { error: 'Configure o bot primeiro.' }, 400)

    const commandId = resource

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(req, { error: 'JSON invalido.' }, 400)
    }

    const updates: Record<string, unknown> = {}

    if (body.description !== undefined) updates.description = String(body.description).trim()
    if (body.type !== undefined) {
      const t = String(body.type).trim()
      if (['builtin', 'shortcut', 'template', 'multi'].includes(t)) updates.type = t
      else return json(req, { error: 'Tipo invalido.' }, 400)
    }
    if (body.actions !== undefined) updates.actions = body.actions
    if (body.category !== undefined) {
      const c = String(body.category).trim()
      if (['tasks', 'activities', 'finance', 'custom'].includes(c)) updates.category = c
      else return json(req, { error: 'Categoria invalida.' }, 400)
    }
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)
    if (body.examples !== undefined) updates.examples = body.examples

    if (Object.keys(updates).length === 0) {
      return json(req, { error: 'Nenhum campo para atualizar.' }, 400)
    }

    const { data: updated, error: updateError } = await sb
      .from('bot_commands')
      .update(updates)
      .eq('id', commandId)
      .eq('tenant_id', tenantId)
      .eq('bot_config_id', config.id) // safety: only own config
      .select()
      .single()

    if (updateError) {
      if (updateError.message?.includes('row')) {
        return json(req, { error: 'Comando nao encontrado.' }, 404)
      }
      return json(req, { error: 'Erro ao atualizar comando.' }, 500)
    }

    return json(req, { command: updated })
  }

  // DELETE /:id — delete command
  if (req.method === 'DELETE' && resource) {
    if (!config) return json(req, { error: 'Configure o bot primeiro.' }, 400)

    const commandId = resource

    const { data: deleted, error: deleteError } = await sb
      .from('bot_commands')
      .delete()
      .eq('id', commandId)
      .eq('tenant_id', tenantId)
      .eq('bot_config_id', config.id)
      .select()
      .maybeSingle()

    if (deleteError) return json(req, { error: 'Erro ao remover comando.' }, 500)
    if (!deleted) return json(req, { error: 'Comando nao encontrado.' }, 404)

    return json(req, { ok: true })
  }

  return json(req, { error: 'Method not allowed' }, 405)
})
