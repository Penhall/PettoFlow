// supabase/functions/telegram-webhook/middleware/auth.ts

interface BotConfig {
  webhook_secret: string
  allowed_telegram_ids: string[]
  is_active: boolean
}

interface AuthResult {
  valid: boolean
  status?: number
  paused?: boolean
  body?: unknown
}

export async function validateRequest(
  req: Request,
  config: BotConfig
): Promise<AuthResult> {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== config.webhook_secret) {
    return { valid: false, status: 401 }
  }

  const body = await req.json()

  const fromId = String(body?.message?.from?.id ?? body?.callback_query?.from?.id ?? '')
  if (!config.allowed_telegram_ids.includes(fromId)) {
    return { valid: false, status: 200 } // silêncio
  }

  if (!config.is_active) {
    return { valid: false, status: 200, paused: true, body }
  }

  return { valid: true, body }
}
