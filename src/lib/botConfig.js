// src/lib/botConfig.js

const BOT_CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-config`
const BOT_CONFIG_KEY = import.meta.env.VITE_BOT_CONFIG_SECRET

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Bot-Config-Key': BOT_CONFIG_KEY,
  }
}

export async function getBotConfig() {
  const res = await fetch(BOT_CONFIG_URL, { headers: headers() })
  if (res.status === 404 || res.status === 204) return null
  if (!res.ok) throw new Error(`Erro ao buscar config: ${res.status}`)
  return res.json()
}

export async function saveBotConfig({ telegramBotToken, llmApiKey, llmProvider, confirmationThreshold }) {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      telegram_bot_token: telegramBotToken,
      llm_api_key: llmApiKey || undefined,
      llm_provider: llmProvider || 'anthropic',
      confirmation_threshold: confirmationThreshold ?? 500,
    }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function updateBotConfig(patch) {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Erro ao atualizar: ${res.status}`)
  return res.json()
}

export async function deleteBotConfig() {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ao remover: ${res.status}`)
  return res.json()
}
