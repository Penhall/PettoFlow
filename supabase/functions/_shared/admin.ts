import { getUserSupabaseClient } from './supabase.ts'
import { getCorsHeaders } from './cors.ts'

function adminError(req: Request, status: number, message: string) {
  const requestId = req.headers.get('x-request-id')?.trim() ?? ''
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
      ...getCorsHeaders(req),
    },
  })
}

export async function getPlatformAdminProfile(req: Request) {
  const sb = getUserSupabaseClient(req)
  const { data, error } = await sb
    .from('platform_admins')
    .select('id, email, role, active')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function requirePlatformAdmin(req: Request) {
  try {
    const profile = await getPlatformAdminProfile(req)
    if (!profile) {
      return {
        ok: false as const,
        profile: null,
        response: adminError(req, 403, 'Acesso administrativo global negado.'),
      }
    }

    return {
      ok: true as const,
      profile,
      response: null,
    }
  } catch (error) {
    return {
      ok: false as const,
      profile: null,
      response: adminError(
        req,
        500,
        error instanceof Error ? error.message : 'Erro ao validar admin global.',
      ),
    }
  }
}
