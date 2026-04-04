// supabase/functions/bot-commands/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'

const DEFAULT_COMMANDS = [
  // Built-ins — tasks
  { trigger: '/tarefa', description: 'Cria uma nova tarefa', type: 'builtin', actions: [], examples: ['Cria uma tarefa de...', 'Adiciona tarefa...'], category: 'tasks' },
  { trigger: '/tarefas', description: 'Lista tarefas pendentes', type: 'builtin', actions: [], examples: ['Quais minhas tarefas?', 'Ver tarefas'], category: 'tasks' },
  { trigger: '/ok', description: 'Conclui uma tarefa pelo número', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/prioridade', description: 'Define prioridade de tarefa', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  // Built-ins — activities
  { trigger: '/nota', description: 'Registra uma nota', type: 'builtin', actions: [], examples: ['Anota que...', 'Registra nota...'], category: 'activities' },
  { trigger: '/reuniao', description: 'Registra uma reunião', type: 'builtin', actions: [], examples: ['Agende uma reunião para...', 'Tive reunião com...'], category: 'activities' },
  { trigger: '/ligacao', description: 'Registra uma ligação', type: 'builtin', actions: [], examples: ['Liguei para...', 'Registra ligação com...'], category: 'activities' },
  { trigger: '/atividades', description: 'Lista atividades recentes', type: 'builtin', actions: [], examples: ['Minhas atividades', 'O que fiz hoje?'], category: 'activities' },
  // Built-ins — finance
  { trigger: '/pagar', description: 'Registra uma saída financeira', type: 'builtin', actions: [], examples: ['Paguei R$X de...', 'Gastei R$X com...'], category: 'finance' },
  { trigger: '/recebi', description: 'Registra uma entrada financeira', type: 'builtin', actions: [], examples: ['Recebi R$X de...', 'Entrada de R$X'], category: 'finance' },
  { trigger: '/saldo', description: 'Consulta saldo das contas', type: 'builtin', actions: [], examples: ['Qual o saldo?', 'Ver saldo'], category: 'finance' },
  { trigger: '/extrato', description: 'Lista últimas transações', type: 'builtin', actions: [], examples: ['Últimas transações', 'Ver extrato'], category: 'finance' },
  // Custom pré-configurados
  { trigger: '/cafe', description: 'Saída rápida: café R$8', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'café', amount: 8.00 } }], examples: [], category: 'custom' },
  { trigger: '/almoco', description: 'Saída rápida: almoço R$35', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'almoço', amount: 35.00 } }], examples: [], category: 'custom' },
  { trigger: '/reuniao-semanal', description: 'Registra reunião semanal de equipe', type: 'template', actions: [{ action: 'activities.log', params: { type: 'meeting', text: 'Reunião semanal de equipe' } }], examples: [], category: 'custom' },
  { trigger: '/inicio-do-dia', description: 'Saldo + lista de tarefas pendentes', type: 'multi', actions: [{ action: 'finance.balance', params: {} }, { action: 'tasks.list', params: {} }], examples: [], category: 'custom' },
  { trigger: '/fim-de-dia', description: 'Tarefas pendentes + extrato do dia', type: 'multi', actions: [{ action: 'tasks.list', params: {} }, { action: 'finance.list', params: {} }], examples: [], category: 'custom' },
]

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function corsHeaders() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Config-Key',
    },
  })
}

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsHeaders()

  const secret = Deno.env.get('BOT_CONFIG_SECRET')
  if (!secret) return json({ error: 'Server misconfiguration' }, 500)

  const configKey = req.headers.get('x-bot-config-key') ?? ''
  if (configKey !== secret) return json({ error: 'Unauthorized' }, 401)

  const sb = getSupabaseClient()
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastSegment = pathParts[pathParts.length - 1]
  const commandId = (lastSegment !== 'bot-commands' && lastSegment !== 'seed') ? lastSegment : null
  const isSeed = lastSegment === 'seed'

  try {
    // GET — lista todos os comandos
    if (req.method === 'GET') {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json([])
      const { data, error } = await sb
        .from('bot_commands')
        .select('*')
        .eq('bot_config_id', botConfigId)
        .order('category')
        .order('type')
        .order('trigger')
      if (error) return json({ error: error.message }, 500)
      return json(data ?? [])
    }

    // POST /seed — insere os comandos padrão
    if (req.method === 'POST' && isSeed) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

      const { count } = await sb
        .from('bot_commands')
        .select('id', { count: 'exact', head: true })
        .eq('bot_config_id', botConfigId)

      if ((count ?? 0) > 0) return json({ ok: true, skipped: true })

      const rows = DEFAULT_COMMANDS.map((cmd) => ({ ...cmd, bot_config_id: botConfigId, is_default: true }))
      const { error } = await sb.from('bot_commands').insert(rows)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, seeded: rows.length })
    }

    // POST — cria um novo comando customizado
    if (req.method === 'POST') {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

      const body = await parseJsonBody(req)
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

      const { trigger, description, type, actions, examples, category } = body

      if (!trigger || !description || !type || !category) {
        return json({ error: 'trigger, description, type e category são obrigatórios' }, 400)
      }
      if (!['shortcut', 'template', 'multi'].includes(type as string)) {
        return json({ error: 'type deve ser shortcut, template ou multi' }, 400)
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

      if (error) return json({ error: error.message }, 500)
      return json(data, 201)
    }

    // PATCH /:id — atualiza um comando
    if (req.method === 'PATCH' && commandId) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

      const body = await parseJsonBody(req)
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

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
      if (error) return json({ error: error.message }, 500)
      if (!data) return json({ error: 'Comando não encontrado' }, 404)
      return json(data)
    }

    // DELETE /:id — remove um comando (somente is_default = false)
    if (req.method === 'DELETE' && commandId) {
      const botConfigId = await getBotConfigId(sb)
      if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

      const { data: existing } = await sb
        .from('bot_commands')
        .select('is_default')
        .eq('id', commandId)
        .eq('bot_config_id', botConfigId)
        .single()

      if (!existing) return json({ error: 'Comando não encontrado' }, 404)
      if (existing.is_default) return json({ error: 'Comandos padrão não podem ser deletados' }, 403)

      const { error } = await sb.from('bot_commands').delete().eq('id', commandId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('[bot-commands] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
