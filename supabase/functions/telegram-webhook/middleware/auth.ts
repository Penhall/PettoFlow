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
  const text = (body?.message?.text ?? '').trim()
  const isStart = text === '/start' || text.startsWith('/start ')

  // Bootstrap: se a allowlist está vazia, apenas /start é permitido (para o dono se registrar)
  const allowlistEmpty = config.allowed_telegram_ids.length === 0
  const inAllowlist = config.allowed_telegram_ids.includes(fromId)
  if (!inAllowlist && !(allowlistEmpty && isStart)) {
    return { valid: false, status: 200 } // silêncio
  }

  if (!config.is_active) {
    return { valid: false, status: 200, paused: true, body }
  }

  return { valid: true, body }
}
