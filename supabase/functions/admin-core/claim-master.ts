import { preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'

export async function handleClaimMaster(req: Request): Promise<Response> {
  const ctx = createRequestContext(req, 'claim-master')
  const request = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (request.method === 'OPTIONS') return preflight(request, 'POST, OPTIONS')

  if (request.method !== 'POST') {
    return ctx.fail(405, 'method_not_allowed', 'Method not allowed')
  }

  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const serviceSb = getServiceRoleClient()

  const { count, error: countError } = await serviceSb
    .from('platform_admins')
    .select('user_id', { count: 'exact', head: true })

  if (countError) return ctx.fail(500, 'check_admins_failed', countError.message)

  if ((count ?? 0) > 0) {
    return ctx.fail(409, 'admin_already_exists', 'Já existe um administrador na plataforma')
  }

  const { data, error } = await serviceSb
    .from('platform_admins')
    .insert({ user_id: auth.user.id, role: 'admin' })
    .select()
    .single()

  if (error) return ctx.fail(500, 'claim_master_failed', error.message)

  ctx.log('info', 'claim_master_success', { user_id: auth.user.id })

  return ctx.ok({
    success: true,
    admin: {
      user_id: data.user_id,
      email: auth.user.email ?? null,
      role: data.role,
    },
  })
}

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return preflight(req, 'POST, OPTIONS')
    return handleClaimMaster(req)
  })
}
