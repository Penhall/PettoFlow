// src/lib/botConfig.js
import { authenticatedFetch } from './apiFetch.js'

const BOT_CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-config`

async function parseResponse(res, fallbackMessage) {
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error ?? fallbackMessage ?? `Erro ${res.status}`)
  }

  return data
}

export async function getBotConfig() {
  const res = await authenticatedFetch(BOT_CONFIG_URL, { method: 'GET' })
  if (res.status === 404 || res.status === 204) return null
  return parseResponse(res, `Erro ao buscar config: ${res.status}`)
}

export async function saveBotConfig({ telegramBotToken, llmApiKey, llmProvider, confirmationThreshold }) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'POST',
    body: JSON.stringify({
      telegram_bot_token: telegramBotToken,
      llm_api_key: llmApiKey || undefined,
      llm_provider: llmProvider || 'anthropic',
      confirmation_threshold: confirmationThreshold ?? 500,
    }),
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function updateBotConfig(patch) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return parseResponse(res, `Erro ao atualizar: ${res.status}`)
}

export async function deleteBotConfig() {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'DELETE',
  })
  return parseResponse(res, `Erro ao remover: ${res.status}`)
}
