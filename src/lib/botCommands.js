// src/lib/botCommands.js

const BOT_COMMANDS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-commands`
const BOT_CONFIG_KEY = import.meta.env.VITE_BOT_CONFIG_SECRET

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Bot-Config-Key': BOT_CONFIG_KEY,
  }
}

export async function listCommands() {
  const res = await fetch(BOT_COMMANDS_URL, { headers: headers() })
  if (!res.ok) throw new Error(`Erro ao listar comandos: ${res.status}`)
  return res.json()
}

export async function createCommand(command) {
  const res = await fetch(BOT_COMMANDS_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(command),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function updateCommand(id, patch) {
  const res = await fetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Erro ao atualizar comando: ${res.status}`)
  return res.json()
}

export async function toggleCommand(id, isActive) {
  return updateCommand(id, { is_active: isActive })
}

export async function deleteCommand(id) {
  const res = await fetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function seedDefaultCommands() {
  const res = await fetch(`${BOT_COMMANDS_URL}/seed`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ao seedar comandos: ${res.status}`)
  return res.json()
}
