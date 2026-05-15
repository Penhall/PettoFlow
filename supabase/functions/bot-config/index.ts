import { json, preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { requireTenantAccess } from '../_shared/tenant.ts'
import { encrypt, decrypt } from '../_shared/crypto.ts'
import { sha256Hex } from '../_shared/hash.ts'
import { registerWebhook, deleteWebhook } from '../_shared/telegram.ts'

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || ''
  if (!supabaseUrl) return ''
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/telegram-webhook`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  const tenant = await requireTenantAccess(req, auth.user.id)
  if (!tenant.ok) return tenant.response
  const tenantId = tenant.tenantId

  const sb = getServiceRoleClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKey) {
    return json(req, { error: 'ENCRYPTION_KEY nao configurada.' }, 500)
  }

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('bot_configs')
      .select('id, is_active, confirmation_threshold, llm_provider, allowed_telegram_ids, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) return json(req, { error: 'Erro ao buscar configuracao do bot.' }, 500)
    if (!data) return json(req, { config: null }, 200)

    return json(req, {
      config: {
        ...data,
        has_llm: !!(data as any).llm_provider, // llm_provider signals LLM is configured
        allowed_telegram_ids: (data as any).allowed_telegram_ids ?? [],
      },
    })
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(req, { error: 'JSON invalido.' }, 400)
    }

    const telegramBotToken = String(body.telegram_bot_token || '').trim()
    if (!telegramBotToken || !/^\d+:[\w-]+$/.test(telegramBotToken)) {
      return json(req, { error: 'Token do Telegram invalido. Deve ser no formato 123456:ABCdef...' }, 400)
    }

    const llmApiKey = body.llm_api_key ? String(body.llm_api_key).trim() : null
    const llmProvider = body.llm_provider ? String(body.llm_provider).trim() : 'anthropic'
    const confirmationThreshold = typeof body.confirmation_threshold === 'number'
      ? body.confirmation_threshold
      : 500

    // Pick provider from LLM key hint
    const detectedProvider = llmApiKey
      ? llmApiKey.startsWith('sk-') ? 'anthropic' : 'google'
      : 'anthropic'

    // Check if config already exists
    const { data: existing } = await sb
      .from('bot_configs')
      .select('id, telegram_bot_token, webhook_secret')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    let webhookSecret: string
    if (existing) {
      // Decrypt existing webhook secret to keep it stable
      try {
        webhookSecret = await decrypt(existing.webhook_secret, encryptionKey)
      } catch {
        webhookSecret = generateSecret()
      }
    } else {
      webhookSecret = generateSecret()
    }

    // Encrypt sensitive fields
    const encryptedToken = await encrypt(telegramBotToken, encryptionKey)
    const encryptedSecret = await encrypt(webhookSecret, encryptionKey)
    const webhookSecretHash = await sha256Hex(webhookSecret)
    const encryptedLlmKey = llmApiKey
      ? await encrypt(llmApiKey, encryptionKey)
      : (existing ? null : null)

    // Register webhook with Telegram
    const webhookUrl = getWebhookUrl()
    if (webhookUrl) {
      const webhookResult = await registerWebhook(telegramBotToken, webhookUrl, webhookSecret)
      if (!webhookResult.ok) {
        return json(req, {
          error: `Falha ao registrar webhook no Telegram: ${webhookResult.description || 'erro desconhecido'}`,
        }, 400)
      }
    }

    // Upsert config
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      telegram_bot_token: encryptedToken,
      webhook_secret: encryptedSecret,
      webhook_secret_sha256: webhookSecretHash,
      is_active: true,
      confirmation_threshold: confirmationThreshold,
      llm_api_key: encryptedLlmKey,
      llm_provider: llmApiKey ? detectedProvider : null,
    }

    const { data: config, error: upsertError } = await sb
      .from('bot_configs')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select('id, is_active, confirmation_threshold, llm_provider, allowed_telegram_ids, created_at, updated_at')
      .maybeSingle()

    if (upsertError) return json(req, { error: 'Erro ao salvar configuracao do bot.' }, 500)

    return json(req, {
      config: {
        ...config,
        has_llm: !!(config as any)?.llm_provider,
        allowed_telegram_ids: (config as any)?.allowed_telegram_ids ?? [],
      },
    })
  }

  if (req.method === 'PATCH') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(req, { error: 'JSON invalido.' }, 400)
    }

    // Get existing config
    const { data: existing, error: fetchError } = await sb
      .from('bot_configs')
      .select('id, telegram_bot_token, webhook_secret')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchError) return json(req, { error: 'Erro ao buscar configuracao do bot.' }, 500)
    if (!existing) return json(req, { error: 'Nenhuma configuracao encontrada. Use POST primeiro.' }, 404)

    const updates: Record<string, unknown> = {}

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active)
    }

    if (body.confirmation_threshold !== undefined) {
      updates.confirmation_threshold = Number(body.confirmation_threshold)
    }

    if (body.llm_api_key !== undefined && body.llm_api_key !== null) {
      const llmKey = String(body.llm_api_key).trim()
      updates.llm_api_key = await encrypt(llmKey, encryptionKey)
      updates.llm_provider = llmKey.startsWith('sk-') ? 'anthropic' : 'google'
    } else if (body.llm_api_key === null) {
      updates.llm_api_key = null
      updates.llm_provider = null
    }

    if (body.llm_provider !== undefined) {
      updates.llm_provider = String(body.llm_provider).trim()
    }

    if (body.allowed_telegram_ids !== undefined) {
      updates.allowed_telegram_ids = body.allowed_telegram_ids as string[]
    }

    if (body.telegram_bot_token) {
      const token = String(body.telegram_bot_token).trim()
      if (!/^\d+:[\w-]+$/.test(token)) {
        return json(req, { error: 'Token do Telegram invalido.' }, 400)
      }
      updates.telegram_bot_token = await encrypt(token, encryptionKey)

      // Re-register webhook with new token
      const webhookUrl = getWebhookUrl()
      if (webhookUrl) {
        const existingToken = await decrypt(existing.telegram_bot_token, encryptionKey)
        const existingSecret = await decrypt(existing.webhook_secret, encryptionKey)
        await deleteWebhook(existingToken)
        const webhookResult = await registerWebhook(token, webhookUrl, existingSecret)
        if (!webhookResult.ok) {
          console.error(`Webhook re-registration failed: ${webhookResult.description}`)
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return json(req, { error: 'Nenhum campo para atualizar.' }, 400)
    }

    const { data: updated, error: updateError } = await sb
      .from('bot_configs')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select('id, is_active, confirmation_threshold, llm_provider, allowed_telegram_ids, created_at, updated_at')
      .single()

    if (updateError) return json(req, { error: 'Erro ao atualizar configuracao do bot.' }, 500)

    return json(req, {
      config: {
        ...updated,
        has_llm: !!(updated as any).llm_provider,
        allowed_telegram_ids: (updated as any).allowed_telegram_ids ?? [],
      },
    })
  }

  if (req.method === 'DELETE') {
    const { data: existing, error: fetchError } = await sb
      .from('bot_configs')
      .select('id, telegram_bot_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchError) return json(req, { error: 'Erro ao buscar configuracao do bot.' }, 500)
    if (!existing) return json(req, { error: 'Nenhuma configuracao encontrada.' }, 404)

    // Delete webhook
    try {
      const token = await decrypt(existing.telegram_bot_token, encryptionKey)
      await deleteWebhook(token)
    } catch (err) {
      console.error('Failed to delete webhook:', err)
    }

    // Delete commands first (cascade should handle this, but explicit is safer)
    await sb.from('bot_commands').delete().eq('tenant_id', tenantId).eq('bot_config_id', existing.id)

    // Delete config
    const { error: deleteError } = await sb.from('bot_configs').delete().eq('tenant_id', tenantId).eq('id', existing.id)
    if (deleteError) return json(req, { error: 'Erro ao remover configuracao do bot.' }, 500)

    return json(req, { ok: true })
  }

  return json(req, { error: 'Method not allowed' }, 405)
})
