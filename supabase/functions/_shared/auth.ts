import { getCorsHeaders } from './cors.ts'
import { getSupabaseClient } from './supabase.ts'

export function authError(req: Request) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
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

  const sb = getSupabaseClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: authError(req), user: null }
  }

  return { ok: true as const, response: null, user: data.user }
}
