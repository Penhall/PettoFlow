import { authenticatedFetch } from './apiFetch.js'
import { adminFetch } from './adminClient.js'

const ADMIN_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-core`

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

export async function fetchAdminOverview({ page = 0, pageSize = 20 } = {}) {
  const url = new URL(`${ADMIN_CORE_URL}/overview`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))

  const res = await authenticatedFetch(url.toString(), { method: 'GET' })
  return parseResponse(res, 'Erro ao carregar painel administrativo')
}

export async function listAdminUsers({ page = 1, perPage = 25 } = {}) {
  const url = new URL(`${ADMIN_CORE_URL}/users`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))

  const res = await authenticatedFetch(url.toString(), { method: 'GET' })
  return parseResponse(res, 'Erro ao carregar usuarios da plataforma')
}

export async function fetchAdminProfile() {
  const res = await authenticatedFetch(`${ADMIN_CORE_URL}/me`, { method: 'GET' })
  return parseResponse(res, 'Erro ao carregar perfil administrativo')
}

export async function claimMaster() {
  return adminFetch('/claim-master', { method: 'POST' })
}
