type TelegramTelemetryPayload = {
  tenantId?: string | null
  chatId?: string | null
  fromId?: string | null
  action?: string | null
  reason?: string | null
  error?: unknown
}

function safeError(error: unknown) {
  if (!error) return undefined
  if (error instanceof Error) return { name: error.name, message: error.message }
  return { message: String(error) }
}

export function traceTelegram(event: string, payload: TelegramTelemetryPayload = {}) {
  const { error, ...rest } = payload
  console.warn('[telegram]', event, {
    ...rest,
    ...(error ? { error: safeError(error) } : {}),
  })
}
