import { getCorsHeaders } from './cors.ts'
import { getServiceRoleClient } from './supabase.ts'

function tenantError(req: Request, status: number, message: string) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

export function getTenantIdFromRequest(req: Request) {
  const tenantId = req.headers.get('x-tenant-id')?.trim() ?? ''
  return tenantId || null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function requireTenantId(req: Request) {
  const tenantId = getTenantIdFromRequest(req)
  if (!tenantId) {
    return {
      ok: false as const,
      tenantId: null,
      response: tenantError(req, 400, 'Tenant id obrigatorio.'),
    }
  }

  if (!isUuid(tenantId)) {
    return {
      ok: false as const,
      tenantId: null,
      response: tenantError(req, 400, 'Tenant id invalido.'),
    }
  }

  return {
    ok: true as const,
    tenantId,
    response: null,
  }
}

export async function assertUserCanAccessTenant(userId: string, tenantId: string) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('memberships')
    .select('tenant_id, user_id, role, status')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false as const,
      membership: null,
    }
  }

  return {
    ok: true as const,
    membership: data,
  }
}

export async function requireTenantAccess(req: Request, userId: string) {
  const tenant = requireTenantId(req)
  if (!tenant.ok) {
    return {
      ok: false as const,
      tenantId: null,
      membership: null,
      response: tenant.response,
    }
  }

  const access = await assertUserCanAccessTenant(userId, tenant.tenantId)
  if (!access.ok) {
    return {
      ok: false as const,
      tenantId: null,
      membership: null,
      response: tenantError(req, 403, 'Acesso ao tenant negado.'),
    }
  }

  return {
    ok: true as const,
    tenantId: tenant.tenantId,
    membership: access.membership,
    response: null,
  }
}
