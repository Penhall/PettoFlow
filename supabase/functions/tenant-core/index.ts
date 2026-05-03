import { json, preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getUserSupabaseClient } from '../_shared/supabase.ts'
import { requireTenantAccess } from '../_shared/tenant.ts'

function getRouteParts(req: Request) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf('tenant-core')
  return {
    url,
    routeParts: index >= 0 ? parts.slice(index + 1) : [],
  }
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function isValidTenantSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req, 'GET, POST, PATCH, OPTIONS')

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const sb = getUserSupabaseClient(req)
  const { routeParts } = getRouteParts(req)
  const resource = routeParts[0] ?? null
  const resourceId = routeParts[1] ?? null
  const action = routeParts[2] ?? null

  try {
    if (req.method === 'GET' && resource === 'tenants' && !resourceId) {
      const { data, error } = await sb
        .from('memberships')
        .select(`
          id,
          role,
          status,
          tenant:tenants (
            id,
            name,
            slug,
            owner_user_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (error) return json(req, { error: error.message }, 500)

      const items = (data ?? [])
        .map((entry) => {
          const tenant = toRecord(entry.tenant)
          if (!tenant.id) return null

          return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            role: entry.role,
            membershipId: entry.id,
            membershipStatus: entry.status,
            ownerUserId: tenant.owner_user_id,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          }
        })
        .filter(Boolean)

      return json(req, { items })
    }

    if (req.method === 'POST' && resource === 'tenants' && !resourceId) {
      const body = toRecord(await req.json())
      const name = String(body.name ?? '').trim()
      const slug = String(body.slug ?? '').trim().toLowerCase()

      if (!name) return json(req, { error: 'Nome do workspace obrigatorio.' }, 400)
      if (!slug) return json(req, { error: 'Slug do workspace obrigatorio.' }, 400)
      if (!isValidTenantSlug(slug)) {
        return json(req, { error: 'Slug do workspace invalido.' }, 400)
      }

      const { data: tenantId, error } = await sb.rpc('create_tenant_with_owner', {
        p_owner_user_id: auth.user.id,
        p_name: name,
        p_slug: slug,
      })

      if (error) {
        const message = error.message ?? 'Erro ao criar workspace.'
        const conflict = message.includes('already exists')
        return json(req, { error: message }, conflict ? 409 : 500)
      }

      const { data: tenant, error: tenantError } = await sb
        .from('tenants')
        .select('id, name, slug, owner_user_id, created_at, updated_at')
        .eq('id', tenantId)
        .single()

      if (tenantError) return json(req, { error: tenantError.message }, 500)

      const { data: membership, error: membershipError } = await sb
        .from('memberships')
        .select('id, role, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', auth.user.id)
        .single()

      if (membershipError) return json(req, { error: membershipError.message }, 500)

      const defaultSettings = {
        workspace_name: tenant.name,
        onboarding_status: 'created',
      }

      const { error: settingsError } = await sb
        .from('tenant_settings')
        .upsert(
          [{ tenant_id: tenantId, key: 'workspace_profile', value: defaultSettings }],
          { onConflict: 'tenant_id,key' },
        )

      if (settingsError) return json(req, { error: settingsError.message }, 500)

      return json(req, {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          ownerUserId: tenant.owner_user_id,
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
        },
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
        },
      }, 201)
    }

    if ((req.method === 'GET' || req.method === 'PATCH') && resource === 'tenants' && resourceId && action === 'settings') {
      const tenantAccess = await requireTenantAccess(req, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return json(req, { error: 'Tenant id do path difere do header.' }, 400)
      }

      if (req.method === 'GET') {
        const { data, error } = await sb
          .from('tenant_settings')
          .select('id, tenant_id, key, value, created_at, updated_at')
          .eq('tenant_id', tenantAccess.tenantId)
          .order('key', { ascending: true })

        if (error) return json(req, { error: error.message }, 500)
        return json(req, { items: data ?? [] })
      }

      const body = toRecord(await req.json())
      const value = body.value

      const { data, error } = await sb
        .from('tenant_settings')
        .upsert(
          [{ tenant_id: tenantAccess.tenantId, key: 'workspace_profile', value: value ?? {} }],
          { onConflict: 'tenant_id,key' },
        )
        .select('id, tenant_id, key, value, created_at, updated_at')
        .single()

      if (error) return json(req, { error: error.message }, 500)
      return json(req, data)
    }

    return json(req, { error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('[tenant-core] unhandled error:', err)
    return json(req, { error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})
