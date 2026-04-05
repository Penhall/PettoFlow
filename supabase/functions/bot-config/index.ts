// supabase/functions/bot-config/index.ts
import { json, preflight, getCorsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'
import { encrypt, decrypt } from '../_shared/crypto.ts'
import { registerWebhook, deleteWebhook } from '../_shared/telegram.ts'

function authError(req: Request) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflight(req)
  }

  const configKey = req.headers.get('x-bot-config-key')
  if (configKey !== Deno.env.get('BOT_CONFIG_SECRET')) return authError(req)

  const sb = getSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`

  if (req.method === 'GET') {
    const { data, error } = await sb.from('bot_configs').select('*').limit(1).single()
    if (error && error.code !== 'PGRST116') return json(req, { error: error.message }, 500)
    if (!data) return json(req, null)
    return json(req, {
      ...data,
      telegram_bot_token: data.telegram_bot_token ? '**********************' : null,
      llm_api_key: data.llm_api_key ? '****************' : null,
    })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { telegram_bot_token, llm_api_key, llm_provider, confirmation_threshold, allowed_telegram_ids } = body

    if (!telegram_bot_token) return json(req, { error: 'telegram_bot_token is required' }, 400)

    const webhookSecretRaw = crypto.randomUUID().replace(/-/g, '')

    const encryptedToken = await encrypt(telegram_bot_token, encryptionKey)
    const encryptedSecret = await encrypt(webhookSecretRaw, encryptionKey)
    const encryptedLlmKey = llm_api_key ? await encrypt(llm_api_key, encryptionKey) : null

    const webhookResult = await registerWebhook(telegram_bot_token, webhookUrl, webhookSecretRaw)
    if (!webhookResult.ok) {
      return json(req, { error: `Telegram rejeitou o token: ${webhookResult.description}` }, 400)
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

    const { data: existing, error: existingError } = await sb.from('bot_configs').select('id').limit(1).single()
    if (existingError && existingError.code !== 'PGRST116') {
      return json(req, { error: existingError.message }, 500)
    }

    if (existing) {
      const { error } = await sb.from('bot_configs').update(payload).eq('id', existing.id)
      if (error) return json(req, { error: error.message }, 500)
    } else {
      const { error } = await sb.from('bot_configs').insert(payload)
      if (error) return json(req, { error: error.message }, 500)
    }

    return json(req, { ok: true, message: 'Bot configurado com sucesso!' })
  }

  if (req.method === 'PATCH') {
    const body = await req.json()
    const { data: existing, error: existingError } = await sb.from('bot_configs').select('id').limit(1).single()
    if (existingError) return json(req, { error: existingError.message }, 500)
    if (!existing) return json(req, { error: 'Bot nao configurado' }, 404)

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.is_active === 'boolean') updatePayload.is_active = body.is_active
    if (typeof body.confirmation_threshold === 'number') updatePayload.confirmation_threshold = body.confirmation_threshold
    if (Array.isArray(body.allowed_telegram_ids)) updatePayload.allowed_telegram_ids = body.allowed_telegram_ids
    if (body.llm_api_key) updatePayload.llm_api_key = await encrypt(body.llm_api_key, encryptionKey)
    if (body.llm_provider) updatePayload.llm_provider = body.llm_provider

    const { error } = await sb.from('bot_configs').update(updatePayload).eq('id', existing.id)
    if (error) return json(req, { error: error.message }, 500)
    return json(req, { ok: true })
  }

  if (req.method === 'DELETE') {
    const { data: existing, error: existingError } = await sb.from('bot_configs').select('telegram_bot_token').limit(1).single()
    if (existingError && existingError.code !== 'PGRST116') {
      return json(req, { error: existingError.message }, 500)
    }

    if (existing?.telegram_bot_token) {
      try {
        const token = await decrypt(existing.telegram_bot_token, encryptionKey)
        await deleteWebhook(token)
      } catch {
        // ignore webhook deletion errors to avoid orphaning encrypted state
      }
    }

    const { error } = await sb.from('bot_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return json(req, { error: error.message }, 500)
    return json(req, { ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
})
