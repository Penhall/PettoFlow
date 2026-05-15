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

export async function getBotConfig(tenantId) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, { method: 'GET', tenantId, requireTenant: true })
  if (res.status === 404 || res.status === 204) return null
  return parseResponse(res, `Erro ao buscar config: ${res.status}`)
}

export async function saveBotConfig({ tenantId, telegramBotToken, llmApiKey, llmProvider, confirmationThreshold }) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'POST',
    tenantId,
    requireTenant: true,
    body: JSON.stringify({
      telegram_bot_token: telegramBotToken,
      llm_api_key: llmApiKey || undefined,
      llm_provider: llmProvider || 'anthropic',
      confirmation_threshold: confirmationThreshold ?? 500,
    }),
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function updateBotConfig(tenantId, patch) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(patch),
  })
  return parseResponse(res, `Erro ao atualizar: ${res.status}`)
}

export async function deleteBotConfig(tenantId) {
  const res = await authenticatedFetch(BOT_CONFIG_URL, {
    method: 'DELETE',
    tenantId,
    requireTenant: true,
  })
  return parseResponse(res, `Erro ao remover: ${res.status}`)
}
