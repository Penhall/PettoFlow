const STORAGE_KEY = 'pettoflow_workspace_secret'
const ENV_SECRET = import.meta.env.VITE_WORKSPACE_ACCESS_SECRET ?? ''

function getSessionWorkspaceSecret() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(STORAGE_KEY) ?? ''
}

export function getWorkspaceSecret() {
  const envSecret = String(ENV_SECRET).trim()
  if (envSecret) return envSecret
  return getSessionWorkspaceSecret()
}

export function hasWorkspaceSecret() {
  return getWorkspaceSecret().trim().length > 0
}

export function hasWorkspaceEnvSecret() {
  return String(ENV_SECRET).trim().length > 0
}

export function setWorkspaceSecret(secret) {
  if (typeof window === 'undefined') return
  const trimmed = String(secret ?? '').trim()
  if (!trimmed) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(STORAGE_KEY, trimmed)
}

export function clearWorkspaceSecret() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

function buildWorkspaceHeaders(contentType = true) {
  const secret = getWorkspaceSecret().trim()
  if (!secret) {
    const error = new Error('Chave do workspace nao configurada.')
    error.code = 'WORKSPACE_SECRET_MISSING'
    throw error
  }

  const headers = { 'X-Workspace-Key': secret }
  if (contentType) headers['Content-Type'] = 'application/json'
  return headers
}

export async function workspaceFetch(url, options = {}) {
  const needsJsonContentType = options.body !== undefined || (options.method && options.method !== 'GET')
  const headers = {
    ...buildWorkspaceHeaders(needsJsonContentType),
    ...(options.headers ?? {}),
  }

  const response = await fetch(url, { ...options, headers })
  if (response.status === 401 || response.status === 403) {
    clearWorkspaceSecret()
  }
  return response
}
