import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { decrypt } from '../../_shared/crypto.ts'
import { sha256Hex } from '../../_shared/hash.ts'
import { traceTelegram } from './telemetry.ts'

export type BotConfigRow = {
  id: string
  tenant_id: string
  telegram_bot_token: string
  webhook_secret: string
  webhook_secret_sha256?: string | null
  allowed_telegram_ids: string[] | null
  is_active: boolean
  confirmation_threshold: number | null
  llm_api_key?: string | null
  llm_provider?: string | null
}

export async function resolveBotConfigFromWebhookSecret(
  sb: SupabaseClient,
  webhookSecret: string,
  encryptionKey: string,
): Promise<BotConfigRow | null> {
  if (!webhookSecret) return null

  const secretHash = await sha256Hex(webhookSecret)
  const { data: hashedConfig, error: hashedError } = await sb
    .from('bot_configs')
    .select('*')
    .eq('webhook_secret_sha256', secretHash)
    .maybeSingle()

  if (hashedError) {
    traceTelegram('tenant_resolution_failed', { reason: 'hash_lookup_error', error: hashedError })
    throw hashedError
  }

  if (hashedConfig?.tenant_id) return hashedConfig as BotConfigRow

  const { data: legacyConfigs, error: legacyError } = await sb
    .from('bot_configs')
    .select('*')
    .is('webhook_secret_sha256', null)
    .not('tenant_id', 'is', null)

  if (legacyError) {
    traceTelegram('tenant_resolution_failed', { reason: 'legacy_lookup_error', error: legacyError })
    throw legacyError
  }

  for (const config of legacyConfigs ?? []) {
    try {
      const decryptedSecret = await decrypt(config.webhook_secret, encryptionKey)
      if (decryptedSecret === webhookSecret) {
        traceTelegram('tenant_resolution_legacy_secret_match', { tenantId: config.tenant_id })
        await sb
          .from('bot_configs')
          .update({ webhook_secret_sha256: secretHash })
          .eq('tenant_id', config.tenant_id)
          .eq('id', config.id)
        return config as BotConfigRow
      }
    } catch (error) {
      traceTelegram('tenant_resolution_secret_decrypt_failed', {
        tenantId: config.tenant_id,
        reason: 'legacy_secret_decrypt_failed',
        error,
      })
    }
  }

  return null
}
