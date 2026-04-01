// supabase/functions/bot-config/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'
import { encrypt, decrypt } from '../_shared/crypto.ts'
import { registerWebhook, deleteWebhook } from '../_shared/telegram.ts'

function authError() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Config-Key',
      },
    })
  }

  const configKey = req.headers.get('x-bot-config-key')
  if (configKey !== Deno.env.get('BOT_CONFIG_SECRET')) return authError()

  const sb = getSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`

  // GET — retorna config atual (sem campos sensíveis descriptografados)
  if (req.method === 'GET') {
    const { data } = await sb.from('bot_configs').select('*').limit(1).single()
    if (!data) return json(null)
    return json({
      ...data,
      telegram_bot_token: data.telegram_bot_token ? '••••••••••••••••••••••' : null,
      llm_api_key: data.llm_api_key ? '••••••••••••••••' : null,
    })
  }

  // POST — cria/atualiza config e registra webhook
  if (req.method === 'POST') {
    const body = await req.json()
    const { telegram_bot_token, llm_api_key, llm_provider, confirmation_threshold, allowed_telegram_ids } = body

    if (!telegram_bot_token) return json({ error: 'telegram_bot_token is required' }, 400)

    // Gera webhook_secret aleatório
    const webhookSecretRaw = crypto.randomUUID().replace(/-/g, '')

    const encryptedToken = await encrypt(telegram_bot_token, encryptionKey)
    const encryptedSecret = await encrypt(webhookSecretRaw, encryptionKey)
    const encryptedLlmKey = llm_api_key ? await encrypt(llm_api_key, encryptionKey) : null

    // Registra webhook no Telegram
    const webhookResult = await registerWebhook(telegram_bot_token, webhookUrl, webhookSecretRaw)
    if (!webhookResult.ok) {
      return json({ error: `Telegram rejeitou o token: ${webhookResult.description}` }, 400)
    }

    const payload = {
      telegram_bot_token: encryptedToken,
      webhook_secret: encryptedSecret,
      allowed_telegram_ids: allowed_telegram_ids ?? [],
      is_active: true,
      confirmation_threshold: confirmation_threshold ?? 500,
      llm_api_key: encryptedLlmKey,
      llm_provider: llm_provider ?? 'anthropic',
      updated_at: new Date().toISOString(),
    }

    // Upsert (single-row)
    const { data: existing } = await sb.from('bot_configs').select('id').limit(1).single()
    if (existing) {
      await sb.from('bot_configs').update(payload).eq('id', existing.id)
    } else {
      await sb.from('bot_configs').insert(payload)
    }

    return json({ ok: true, message: 'Bot configurado com sucesso!' })
  }

  // PATCH — atualiza campos específicos (pause/resume, threshold, allowlist)
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { data: existing } = await sb.from('bot_configs').select('id').limit(1).single()
    if (!existing) return json({ error: 'Bot não configurado' }, 404)

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.is_active === 'boolean') updatePayload.is_active = body.is_active
    if (typeof body.confirmation_threshold === 'number') updatePayload.confirmation_threshold = body.confirmation_threshold
    if (Array.isArray(body.allowed_telegram_ids)) updatePayload.allowed_telegram_ids = body.allowed_telegram_ids
    if (body.llm_api_key) updatePayload.llm_api_key = await encrypt(body.llm_api_key, encryptionKey)
    if (body.llm_provider) updatePayload.llm_provider = body.llm_provider

    await sb.from('bot_configs').update(updatePayload).eq('id', existing.id)
    return json({ ok: true })
  }

  // DELETE — remove config e cancela webhook
  if (req.method === 'DELETE') {
    const { data: existing } = await sb.from('bot_configs').select('telegram_bot_token').limit(1).single()
    if (existing?.telegram_bot_token) {
      try {
        const token = await decrypt(existing.telegram_bot_token, encryptionKey)
        await deleteWebhook(token)
      } catch { /* ignora erro no delete do webhook */ }
    }
    await sb.from('bot_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    return json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
})
