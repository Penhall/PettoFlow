// supabase/functions/bot-commands/index.ts
import { json, preflight } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

const DEFAULT_COMMANDS = [
  { trigger: '/tarefa', description: 'Cria uma nova tarefa', type: 'builtin', actions: [], examples: ['Cria uma tarefa de...', 'Adiciona tarefa...'], category: 'tasks' },
  { trigger: '/tarefas', description: 'Lista tarefas pendentes', type: 'builtin', actions: [], examples: ['Quais minhas tarefas?', 'Ver tarefas'], category: 'tasks' },
  { trigger: '/ok', description: 'Conclui uma tarefa pelo numero', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/prioridade', description: 'Define prioridade de tarefa', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/nota', description: 'Registra uma nota', type: 'builtin', actions: [], examples: ['Anota que...', 'Registra nota...'], category: 'activities' },
  { trigger: '/reuniao', description: 'Registra uma reuniao', type: 'builtin', actions: [], examples: ['Agende uma reuniao para...', 'Tive reuniao com...'], category: 'activities' },
  { trigger: '/ligacao', description: 'Registra uma ligacao', type: 'builtin', actions: [], examples: ['Liguei para...', 'Registra ligacao com...'], category: 'activities' },
  { trigger: '/atividades', description: 'Lista atividades recentes', type: 'builtin', actions: [], examples: ['Minhas atividades', 'O que fiz hoje?'], category: 'activities' },
  { trigger: '/pagar', description: 'Registra uma saida financeira', type: 'builtin', actions: [], examples: ['Paguei R$X de...', 'Gastei R$X com...'], category: 'finance' },
  { trigger: '/recebi', description: 'Registra uma entrada financeira', type: 'builtin', actions: [], examples: ['Recebi R$X de...', 'Entrada de R$X'], category: 'finance' },
  { trigger: '/saldo', description: 'Consulta saldo das contas', type: 'builtin', actions: [], examples: ['Qual o saldo?', 'Ver saldo'], category: 'finance' },
  { trigger: '/extrato', description: 'Lista ultimas transacoes', type: 'builtin', actions: [], examples: ['Ultimas transacoes', 'Ver extrato'], category: 'finance' },
  { trigger: '/cafe', description: 'Saida rapida: cafe R$8', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'cafe', amount: 8.0 } }], examples: [], category: 'custom' },
  { trigger: '/almoco', description: 'Saida rapida: almoco R$35', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'almoco', amount: 35.0 } }], examples: [], category: 'custom' },
  { trigger: '/reuniao-semanal', description: 'Registra reuniao semanal de equipe', type: 'template', actions: [{ action: 'activities.log', params: { type: 'meeting', text: 'Reuniao semanal de equipe' } }], examples: [], category: 'custom' },
  { trigger: '/inicio-do-dia', description: 'Saldo + lista de tarefas pendentes', type: 'multi', actions: [{ action: 'finance.balance', params: {} }, { action: 'tasks.list', params: {} }], examples: [], category: 'custom' },
  { trigger: '/fim-de-dia', description: 'Tarefas pendentes + extrato do dia', type: 'multi', actions: [{ action: 'tasks.list', params: {} }, { action: 'finance.list', params: {} }], examples: [], category: 'custom' },
]

async function getBotConfigId(sb: ReturnType<typeof getSupabaseClient>): Promise<string | null> {
  const { data, error } = await sb.from('bot_configs').select('id').limit(1).single()
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch bot config: ${error.message}`)
  }
  return data?.id ?? null
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

function hasValidActions(actions: unknown) {
  if (actions === undefined) return true
  if (!Array.isArray(actions)) return false
  return actions.every((item) => {
    if (typeof item !== 'object' || item === null) return false
    return typeof (item as Record<string, unknown>).action === 'string'
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const secret = Deno.env.get('BOT_CONFIG_SECRET')
  if (!secret) return json(req, { error: 'Server misconfiguration' }, 500)

  const configKey = req.headers.get('x-bot-config-key') ?? ''
  if (configKey !== secret) return json(req, { error: 'Unauthorized' }, 401)

  const sb = getSupabaseClient()
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastSegment = pathParts[pathParts.length - 1]
  const commandId = lastSegment !== 'bot-commands' && lastSegment !== 'seed' ? lastSegment : null
  const isSeed = lastSegment === 'seed'

  try {
    if (req.method === 'GET') {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json(req, [])
      const { data, error } = await sb
        .from('bot_commands')
        .select('*')
        .eq('bot_config_id', botConfigId)
        .order('category')
        .order('type')
        .order('trigger')
      if (error) return json(req, { error: error.message }, 500)
      return json(req, data ?? [])
    }

    if (req.method === 'POST' && isSeed) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json(req, { error: 'Bot nao configurado' }, 404)

      const { count } = await sb
        .from('bot_commands')
        .select('id', { count: 'exact', head: true })
        .eq('bot_config_id', botConfigId)

      if ((count ?? 0) > 0) return json(req, { ok: true, skipped: true })

      const rows = DEFAULT_COMMANDS.map((cmd) => ({ ...cmd, bot_config_id: botConfigId, is_default: true }))
      const { error } = await sb.from('bot_commands').insert(rows)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true, seeded: rows.length })
    }

    if (req.method === 'POST') {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json(req, { error: 'Bot nao configurado' }, 404)

      const body = await parseJsonBody(req)
      if (!body) return json(req, { error: 'Invalid JSON body' }, 400)

      const { trigger, description, type, actions, examples, category } = body

      if (!trigger || !description || !type || !category) {
        return json(req, { error: 'trigger, description, type e category sao obrigatorios' }, 400)
      }
      if (!['shortcut', 'template', 'multi'].includes(type as string)) {
        return json(req, { error: 'type deve ser shortcut, template ou multi' }, 400)
      }
      if (!hasValidActions(actions)) {
        return json(req, { error: 'actions deve ser um array de objetos com action string' }, 400)
      }

      const { data, error } = await sb.from('bot_commands').insert({
        bot_config_id: botConfigId,
        trigger,
        description,
        type,
        actions: actions ?? [],
        examples: examples ?? [],
        category,
        is_default: false,
      }).select().single()

      if (error) return json(req, { error: error.message }, 500)
      return json(req, data, 201)
    }

    if (req.method === 'PATCH' && commandId) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json(req, { error: 'Bot nao configurado' }, 404)

      const body = await parseJsonBody(req)
      if (!body) return json(req, { error: 'Invalid JSON body' }, 400)
      if ('actions' in body && !hasValidActions(body.actions)) {
        return json(req, { error: 'actions deve ser um array de objetos com action string' }, 400)
      }

      const allowedFields = ['is_active', 'description', 'actions', 'examples']
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const field of allowedFields) {
        if (field in body) patch[field] = body[field]
      }

      const { data, error } = await sb
        .from('bot_commands')
        .update(patch)
        .eq('id', commandId)
        .eq('bot_config_id', botConfigId)
        .select()
        .single()
      if (error) return json(req, { error: error.message }, 500)
      if (!data) return json(req, { error: 'Comando nao encontrado' }, 404)
      return json(req, data)
    }

    if (req.method === 'DELETE' && commandId) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json(req, { error: 'Bot nao configurado' }, 404)

      const { data: existing } = await sb
        .from('bot_commands')
        .select('is_default')
        .eq('id', commandId)
        .eq('bot_config_id', botConfigId)
        .single()

      if (!existing) return json(req, { error: 'Comando nao encontrado' }, 404)
      if (existing.is_default) return json(req, { error: 'Comandos padrao nao podem ser deletados' }, 403)

      const { error } = await sb.from('bot_commands').delete().eq('id', commandId).eq('bot_config_id', botConfigId)
      if (error) return json(req, { error: error.message }, 500)
      return json(req, { ok: true })
    }

    return json(req, { error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('[bot-commands] unhandled error:', err)
    return json(req, { error: 'Internal server error' }, 500)
  }
})
