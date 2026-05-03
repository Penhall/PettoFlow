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

export async function listCommands() {
  const res = await authenticatedFetch(BOT_COMMANDS_URL, { method: 'GET' })
  return parseResponse(res, `Erro ao listar comandos: ${res.status}`)
}

export async function createCommand(command) {
  const res = await authenticatedFetch(BOT_COMMANDS_URL, {
    method: 'POST',
    body: JSON.stringify(command),
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function updateCommand(id, patch) {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return parseResponse(res, `Erro ao atualizar comando: ${res.status}`)
}

export async function toggleCommand(id, isActive) {
  return updateCommand(id, { is_active: isActive })
}

export async function deleteCommand(id) {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'DELETE',
  })
  return parseResponse(res, `Erro ${res.status}`)
}

export async function seedDefaultCommands() {
  const res = await authenticatedFetch(`${BOT_COMMANDS_URL}/seed`, {
    method: 'POST',
  })
  return parseResponse(res, `Erro ao seedar comandos: ${res.status}`)
}
