const STORAGE_KEY = 'pettoflow_bot_admin_secret'
const ENV_SECRET = String(import.meta.env.VITE_BOT_CONFIG_SECRET ?? '').trim()

export function hasBotAdminEnvSecret() {
  return ENV_SECRET.length > 0
}

function getSessionBotAdminSecret() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(STORAGE_KEY) ?? ''
}

export function getBotAdminSecret() {
  if (ENV_SECRET) return ENV_SECRET
  return getSessionBotAdminSecret()
}

export function hasBotAdminSecret() {
  return getBotAdminSecret().trim().length > 0
}

export function setBotAdminSecret(secret) {
  if (typeof window === 'undefined') return
  const trimmed = String(secret ?? '').trim()
  if (!trimmed) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(STORAGE_KEY, trimmed)
}

export function clearBotAdminSecret() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

function buildBotAdminHeaders(contentType = true) {
  const secret = getBotAdminSecret().trim()
  if (!secret) {
    const error = new Error('Chave administrativa não configurada para esta sessão.')
    error.code = 'BOT_ADMIN_SECRET_MISSING'
    throw error
  }

  const headers = { 'X-Bot-Config-Key': secret }
  if (contentType) headers['Content-Type'] = 'application/json'
  return headers
}

export async function botAdminFetch(url, options = {}) {
  const needsJsonContentType = options.body !== undefined || (options.method && options.method !== 'GET')
  const headers = {
    ...buildBotAdminHeaders(needsJsonContentType),
    ...(options.headers ?? {}),
  }

  const response = await fetch(url, { ...options, headers })

  if (response.status === 401 || response.status === 403) {
    clearBotAdminSecret()
  }

  return response
}
