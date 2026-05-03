import { preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { requirePlatformAdmin } from '../_shared/admin.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { getTenantUsageSnapshot } from '../_shared/billing.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'

function getRouteParts(req: Request) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf('admin-core')
  return {
    url,
    routeParts: index >= 0 ? parts.slice(index + 1) : [],
  }
}

function parsePositiveInt(value: string | null, fallback: number, min = 1, max = 200) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback
  }
  return parsed
}

Deno.serve(async (req: Request) => {
  const ctx = createRequestContext(req, 'admin-core')
  const request = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (request.method === 'OPTIONS') return preflight(request, 'GET, OPTIONS')

  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const admin = await requirePlatformAdmin(request)
  if (!admin.ok) return admin.response

  const serviceSb = getServiceRoleClient()
  const { url, routeParts } = getRouteParts(request)
  const resource = routeParts[0] ?? 'overview'

  try {
    if (request.method === 'GET' && resource === 'me') {
      return ctx.ok({
        admin: {
          email: admin.profile.email,
          role: admin.profile.role,
        },
      })
    }

    if (request.method === 'GET' && resource === 'users') {
      const page = parsePositiveInt(url.searchParams.get('page'), 1, 1, 200)
      const perPage = parsePositiveInt(url.searchParams.get('perPage'), 25, 1, 200)
      const { data, error } = await serviceSb.auth.admin.listUsers({ page, perPage })
      if (error) return ctx.fail(500, 'admin_users_list_failed', error.message)

      const items = (data?.users ?? []).map((user) => ({
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
      }))

      return ctx.ok({
        items,
        page,
        perPage,
        total: data?.total ?? items.length,
      })
    }

    if (request.method === 'GET' && resource === 'overview') {
      const tenantPage = parsePositiveInt(url.searchParams.get('page'), 0, 0, 1000)
      const tenantPageSize = parsePositiveInt(url.searchParams.get('pageSize'), 20, 1, 100)
      const from = tenantPage * tenantPageSize
      const to = from + tenantPageSize - 1

      const [
        tenantCountResult,
        subscriptionCountResult,
        auditCountResult,
        billingEventCountResult,
        tenantsResult,
        subscriptionsResult,
        auditLogsResult,
        billingEventsResult,
      ] = await Promise.all([
        serviceSb.from('tenants').select('id', { count: 'exact', head: true }),
        serviceSb.from('subscriptions').select('id', { count: 'exact', head: true }),
        serviceSb.from('audit_logs').select('id', { count: 'exact', head: true }),
        serviceSb.from('billing_events').select('id', { count: 'exact', head: true }),
        serviceSb
          .from('tenants')
          .select('id, name, slug, owner_user_id, created_at, updated_at')
          .order('created_at', { ascending: false })
          .range(from, to),
        serviceSb
          .from('subscriptions')
          .select(`
            id,
            tenant_id,
            status,
            provider,
            billing_interval,
            provider_customer_id,
            provider_subscription_id,
            cancel_at_period_end,
            current_period_end,
            updated_at,
            plan:plans (
              id,
              name,
              slug
            )
          `)
          .order('updated_at', { ascending: false })
          .limit(50),
        serviceSb
          .from('audit_logs')
          .select('id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        serviceSb
          .from('billing_events')
          .select('id, provider, event_id, event_type, tenant_id, status, error_message, created_at, processed_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (tenantCountResult.error) return ctx.fail(500, 'admin_tenant_count_failed', tenantCountResult.error.message)
      if (subscriptionCountResult.error) return ctx.fail(500, 'admin_subscription_count_failed', subscriptionCountResult.error.message)
      if (auditCountResult.error) return ctx.fail(500, 'admin_audit_count_failed', auditCountResult.error.message)
      if (billingEventCountResult.error) return ctx.fail(500, 'admin_billing_event_count_failed', billingEventCountResult.error.message)
      if (tenantsResult.error) return ctx.fail(500, 'admin_tenants_list_failed', tenantsResult.error.message)
      if (subscriptionsResult.error) return ctx.fail(500, 'admin_subscriptions_list_failed', subscriptionsResult.error.message)
      if (auditLogsResult.error) return ctx.fail(500, 'admin_audit_logs_list_failed', auditLogsResult.error.message)
      if (billingEventsResult.error) return ctx.fail(500, 'admin_billing_events_list_failed', billingEventsResult.error.message)

      const usageByTenant = await Promise.all(
        (tenantsResult.data ?? []).map(async (tenant) => ({
          tenantId: tenant.id,
          usage: await getTenantUsageSnapshot(tenant.id),
        })),
      )

      const usageMap = new Map(usageByTenant.map((entry) => [entry.tenantId, entry.usage]))

      return ctx.ok({
        counts: {
          tenants: tenantCountResult.count ?? 0,
          subscriptions: subscriptionCountResult.count ?? 0,
          auditLogs: auditCountResult.count ?? 0,
          billingEvents: billingEventCountResult.count ?? 0,
        },
        tenants: (tenantsResult.data ?? []).map((tenant) => ({
          ...tenant,
          usage: usageMap.get(tenant.id) ?? {},
        })),
        subscriptions: subscriptionsResult.data ?? [],
        auditLogs: auditLogsResult.data ?? [],
        billingEvents: billingEventsResult.data ?? [],
        page: tenantPage,
        pageSize: tenantPageSize,
      })
    }

    return ctx.fail(405, 'method_not_allowed', 'Method not allowed')
  } catch (error) {
    ctx.log('error', 'request_crashed', {
      error: error instanceof Error ? error.message : 'Internal server error',
      user_id: auth.user.id,
    })
    return ctx.fail(500, 'internal_server_error', error instanceof Error ? error.message : 'Internal server error')
  }
})
