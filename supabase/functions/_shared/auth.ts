import { getCorsHeaders } from './cors.ts'
import { getServiceRoleClient } from './supabase.ts'

export function authError(req: Request) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  const requestId = req.headers.get('x-request-id')?.trim() ?? ''
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
      ...corsHeaders,
    },
  })
}

export async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) {
    return { ok: false as const, response: authError(req), user: null }
  }

  const sb = getServiceRoleClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: authError(req), user: null }
  }

  return { ok: true as const, response: null, user: data.user }
}
