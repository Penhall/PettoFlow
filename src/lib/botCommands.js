// src/lib/botCommands.js
import { authenticatedFetch } from './apiFetch.js'

const BOT_COMMANDS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-commands`

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

export async function listCommands(tenantId) {
  const res = await authenticatedFetch(BOT_COMMANDS_URL, { method: 'GET', tenantId, requireTenant: true })
  return parseResponse(res, `Erro ao listar comandos: ${res.status}`)
}

export async function createCommand(tenantId, command) {
  const res = await authenticatedFetch(BOT_COMMANDS_URL, {
    method: 'POST',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(command),
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function updateCommand(tenantId, id, patch) {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'PATCH',
    tenantId,
    requireTenant: true,
    body: JSON.stringify(patch),
  })
  return parseResponse(res, `Erro ao atualizar comando: ${res.status}`)
}

export async function toggleCommand(tenantId, id, isActive) {
  return updateCommand(tenantId, id, { is_active: isActive })
}

export async function deleteCommand(tenantId, id) {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'DELETE',
    tenantId,
    requireTenant: true,
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function seedDefaultCommands(tenantId) {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/seed`, {
    method: 'POST',
    tenantId,
    requireTenant: true,
  })
  return parseResponse(res, `Erro ao seedar comandos: ${res.status}`)
}
