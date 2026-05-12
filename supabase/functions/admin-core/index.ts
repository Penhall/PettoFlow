import { preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { requirePlatformAdmin } from '../_shared/admin.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { getTenantUsageSnapshot } from '../_shared/billing.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'
import { handleClaimMaster } from './claim-master.ts'

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

  const { url, routeParts } = getRouteParts(request)
  const resource = routeParts[0] ?? 'overview'

  if (request.method === 'POST' && resource === 'claim-master') {
    return handleClaimMaster(request)
  }

  const admin = await requirePlatformAdmin(request)
  if (!admin.ok) return admin.response

  const serviceSb = getServiceRoleClient()

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

    if (request.method === 'GET' && resource === 'tenants' && routeParts.length === 1) {
      const [tenantsResult, subscriptionsResult, membershipsResult] = await Promise.all([
        serviceSb.from('tenants').select('id, name, slug, owner_user_id, created_at').order('created_at', { ascending: false }),
        serviceSb.from('subscriptions').select('tenant_id, status, plan:plans(name)'),
        serviceSb.from('memberships').select('tenant_id, user_id, status').eq('status', 'active'),
      ])
      if (tenantsResult.error) return ctx.fail(500, 'admin_tenants_failed', tenantsResult.error.message)
      if (subscriptionsResult.error) return ctx.fail(500, 'admin_subscriptions_failed', subscriptionsResult.error.message)
      if (membershipsResult.error) return ctx.fail(500, 'admin_memberships_failed', membershipsResult.error.message)

      const ownerIds = [...new Set((tenantsResult.data ?? []).map(t => t.owner_user_id).filter(Boolean))]
      const ownerEmails: Record<string, string> = {}
      await Promise.all(ownerIds.map(async (uid) => {
        const { data } = await serviceSb.auth.admin.getUserById(uid)
        if (data?.user?.email) ownerEmails[uid] = data.user.email
      }))

      const subByTenant = new Map<string, any>()
      for (const sub of subscriptionsResult.data ?? []) subByTenant.set(sub.tenant_id, sub)
      const memberCountByTenant = new Map<string, number>()
      for (const m of membershipsResult.data ?? []) {
        memberCountByTenant.set(m.tenant_id, (memberCountByTenant.get(m.tenant_id) ?? 0) + 1)
      }

      const tenants = (tenantsResult.data ?? []).map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        owner_user_id: t.owner_user_id,
        created_at: t.created_at,
        plan_name: (subByTenant.get(t.id) as any)?.plan?.name ?? 'free',
        user_count: memberCountByTenant.get(t.id) ?? 0,
        owner_email: ownerEmails[t.owner_user_id] ?? null,
      }))

      return ctx.ok({ tenants })
    }

    if (request.method === 'GET' && resource === 'tenants' && routeParts.length === 2) {
      const tenantId = routeParts[1]

      const [tenantResult, subResult, membersResult] = await Promise.all([
        serviceSb.from('tenants').select('id, name, slug, owner_user_id, created_at').eq('id', tenantId).single(),
        serviceSb.from('subscriptions').select('status, billing_interval, current_period_end, plan:plans(name, slug)').eq('tenant_id', tenantId).maybeSingle(),
        serviceSb.from('memberships').select('user_id, role, status').eq('tenant_id', tenantId).eq('status', 'active'),
      ])

      if (tenantResult.error) return ctx.fail(404, 'tenant_not_found', 'Tenant não encontrado')

      let ownerEmail: string | null = null
      if (tenantResult.data?.owner_user_id) {
        const { data: ownerData } = await serviceSb.auth.admin.getUserById(tenantResult.data.owner_user_id)
        ownerEmail = ownerData?.user?.email ?? null
      }

      return ctx.ok({
        tenant: {
          ...tenantResult.data,
          owner_email: ownerEmail,
          subscription: subResult.data ?? null,
          active_members: membersResult.data ?? [],
        }
      })
    }

    if (request.method === 'GET' && resource === 'metrics') {
      const [totalResult, subsResult, recentResult, memberResult] = await Promise.all([
        serviceSb.from('tenants').select('id', { count: 'exact', head: true }),
        serviceSb.from('subscriptions').select('tenant_id, status, plan:plans(name, slug, price_monthly)'),
        serviceSb.from('tenants').select('id, name, slug, created_at').order('created_at', { ascending: false }).limit(5),
        serviceSb.from('memberships').select('tenant_id, status').eq('status', 'active'),
      ])

      if (totalResult.error) return ctx.fail(500, 'metrics_failed', totalResult.error.message)

      const subs = subsResult.data ?? []
      const activeMembers = memberResult.data ?? []

      const tenantsWithMembers = new Set(activeMembers.map(m => m.tenant_id))
      const activeTenants = tenantsWithMembers.size

      const planDist: Record<string, number> = {}
      for (const sub of subs) {
        const planName = (sub.plan as any)?.slug ?? 'free'
        planDist[planName] = (planDist[planName] ?? 0) + 1
      }

      const activeSubs = subs.filter(s => s.status === 'active')
      const mrrTotal = activeSubs.reduce((sum, sub) => {
        const price = (sub.plan as any)?.price_monthly ?? 0
        return sum + Number(price)
      }, 0)

      return ctx.ok({
        total_tenants: totalResult.count ?? 0,
        active_tenants: activeTenants,
        plan_distribution: planDist,
        recent_tenants: recentResult.data ?? [],
        mrr_total: mrrTotal,
      })
    }

    if (request.method === 'GET' && resource === 'audit') {
      const tenantId = url.searchParams.get('tenant_id')
      const eventName = url.searchParams.get('event_name')
      const dateFrom = url.searchParams.get('date_from')
      const dateTo = url.searchParams.get('date_to')
      const page = parsePositiveInt(url.searchParams.get('page'), 0, 0, 10000)
      const pageSize = parsePositiveInt(url.searchParams.get('page_size'), 50, 1, 100)

      let query = serviceSb
        .from('audit_logs')
        .select('id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at, tenant:tenants(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (tenantId) query = query.eq('tenant_id', tenantId)
      if (eventName) query = query.eq('action', eventName)
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)

      const { data, error, count } = await query
      if (error) return ctx.fail(500, 'audit_failed', error.message)

      const logs = (data ?? []).map(log => ({
        ...log,
        event_name: log.action,
        tenant_name: (log.tenant as any)?.name ?? null,
      }))

      return ctx.ok({ logs, total: count ?? 0, page, page_size: pageSize })
    }

    if (request.method === 'PATCH' && resource === 'tenants' && routeParts.length === 3 && routeParts[2] === 'plan') {
      const tenantId = routeParts[1]
      const body = await request.json().catch(() => ({}))
      const planSlug = typeof body.plan_slug === 'string' ? body.plan_slug.toLowerCase() : null
      if (!planSlug) return ctx.fail(400, 'invalid_body', 'plan_slug obrigatório')

      const { data: plan, error: planError } = await serviceSb
        .from('plans')
        .select('id, name, slug')
        .filter('slug', 'ilike', planSlug)
        .eq('active', true)
        .maybeSingle()

      if (planError) return ctx.fail(500, 'plan_lookup_failed', planError.message)
      if (!plan) return ctx.fail(404, 'plan_not_found', `Plano '${planSlug}' não encontrado`)

      const { data: existing, error: subFetchError } = await serviceSb
        .from('subscriptions')
        .select('id, plan_id, plan:plans(slug)')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (subFetchError) return ctx.fail(500, 'subscription_lookup_failed', subFetchError.message)

      const fromPlan = (existing?.plan as any)?.slug ?? 'free'

      let subscription: any
      if (existing) {
        const { data: updated, error: updateError } = await serviceSb
          .from('subscriptions')
          .update({ plan_id: plan.id, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .select()
          .single()
        if (updateError) return ctx.fail(500, 'subscription_update_failed', updateError.message)
        subscription = updated
      } else {
        const { data: inserted, error: insertError } = await serviceSb
          .from('subscriptions')
          .insert({ tenant_id: tenantId, plan_id: plan.id, status: 'active', provider: 'internal' })
          .select()
          .single()
        if (insertError) return ctx.fail(500, 'subscription_insert_failed', insertError.message)
        subscription = inserted
      }

      await serviceSb.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: auth.user.id,
        action: 'subscription.plan_changed',
        resource_type: 'subscription',
        metadata: { from_plan: fromPlan, to_plan: plan.slug },
      })

      return ctx.ok({ ok: true, subscription })
    }

    if (request.method === 'GET' && resource === 'plans' && routeParts.length === 1) {
      const { data, error } = await serviceSb
        .from('plans')
        .select(`
          id, name, slug, limits, price_monthly, price_yearly, active, created_at, updated_at,
          active_subscriptions_count:subscriptions(count)
        `)
        .order('price_monthly', { ascending: true })

      if (error) return ctx.fail(500, 'plans_list_failed', error.message)

      const plans = (data ?? []).map((p) => ({
        ...p,
        active_subscriptions_count: Array.isArray(p.active_subscriptions_count)
          ? (p.active_subscriptions_count[0] as any)?.count ?? 0
          : 0,
      }))

      return ctx.ok({ plans })
    }

    if (request.method === 'POST' && resource === 'plans') {
      const body = await request.json().catch(() => ({}))
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''

      if (!name) return ctx.fail(400, 'invalid_body', 'name é obrigatório')
      if (!slug) return ctx.fail(400, 'invalid_body', 'slug é obrigatório')

      const { data: existing } = await serviceSb
        .from('plans')
        .select('id')
        .filter('slug', 'ilike', slug)
        .maybeSingle()

      if (existing) return ctx.fail(409, 'slug_conflict', `Slug '${slug}' já está em uso`)

      const { data: plan, error } = await serviceSb
        .from('plans')
        .insert({
          name,
          slug,
          limits: body.limits ?? {},
          price_monthly: body.price_monthly ?? 0,
          price_yearly: body.price_yearly ?? 0,
          active: body.active !== false,
        })
        .select()
        .single()

      if (error) return ctx.fail(500, 'plan_create_failed', error.message)
      return ctx.ok({ plan })
    }

    if (request.method === 'PATCH' && resource === 'plans' && routeParts.length === 2) {
      const planId = routeParts[1]
      const body = await request.json().catch(() => ({}))

      if (body.active === false) {
        const { count } = await serviceSb
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', planId)
          .eq('status', 'active')

        if ((count ?? 0) > 0) {
          return ctx.fail(409, 'plan_has_active_subscriptions', 'Plano possui assinaturas ativas. Não é possível desativá-lo.')
        }
      }

      if (typeof body.slug === 'string') {
        const slugNorm = body.slug.trim().toLowerCase()
        const { data: existing } = await serviceSb
          .from('plans')
          .select('id')
          .filter('slug', 'ilike', slugNorm)
          .neq('id', planId)
          .maybeSingle()

        if (existing) return ctx.fail(409, 'slug_conflict', `Slug '${slugNorm}' já está em uso`)
        body.slug = slugNorm
      }

      const allowed = ['name', 'slug', 'limits', 'price_monthly', 'price_yearly', 'active']
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      for (const key of allowed) {
        if (key in body) updates[key] = body[key]
      }

      const { data: plan, error } = await serviceSb
        .from('plans')
        .update(updates)
        .eq('id', planId)
        .select()
        .single()

      if (error) return ctx.fail(500, 'plan_update_failed', error.message)
      return ctx.ok({ plan })
    }

    if (request.method === 'DELETE' && resource === 'plans' && routeParts.length === 2) {
      const planId = routeParts[1]

      const { data: planRow, error: planFetchError } = await serviceSb
        .from('plans')
        .select('id, slug')
        .eq('id', planId)
        .maybeSingle()

      if (planFetchError) return ctx.fail(500, 'plan_lookup_failed', planFetchError.message)
      if (!planRow) return ctx.fail(404, 'plan_not_found', 'Plano não encontrado')

      if (planRow.slug === 'free') {
        return ctx.fail(400, 'plan_protected', 'Plano Free não pode ser excluído.')
      }

      const { count } = await serviceSb
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', planId)

      if ((count ?? 0) > 0) {
        return ctx.fail(409, 'plan_has_subscriptions', 'Plano possui assinaturas ativas. Remova ou migre os tenants primeiro.')
      }

      const { error } = await serviceSb.from('plans').delete().eq('id', planId)
      if (error) return ctx.fail(500, 'plan_delete_failed', error.message)
      return ctx.ok({ ok: true })
    }

    if (request.method === 'POST' && resource === 'tenants' && routeParts.length === 3 && routeParts[2] === 'suspend') {
      const tenantId = routeParts[1]
      const body = await request.json().catch(() => ({}))
      const action = body.action

      if (action !== 'suspend' && action !== 'reactivate') {
        return ctx.fail(400, 'invalid_action', 'action deve ser suspend ou reactivate')
      }

      const { data: existing } = await serviceSb
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (action === 'suspend') {
        if (!existing) return ctx.fail(404, 'subscription_not_found', 'Assinatura não encontrada')
        const { error } = await serviceSb
          .from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
        if (error) return ctx.fail(500, 'suspend_failed', error.message)

        await serviceSb.from('audit_logs').insert({
          tenant_id: tenantId,
          user_id: auth.user.id,
          action: 'tenant.suspended',
          resource_type: 'subscription',
          metadata: {},
        })
      } else {
        if (!existing) {
          const { error } = await serviceSb.rpc('ensure_default_subscription', { p_tenant_id: tenantId })
          if (error) return ctx.fail(500, 'ensure_subscription_failed', error.message)
        } else {
          const { error } = await serviceSb
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
          if (error) return ctx.fail(500, 'reactivate_failed', error.message)
        }

        await serviceSb.from('audit_logs').insert({
          tenant_id: tenantId,
          user_id: auth.user.id,
          action: 'tenant.reactivated',
          resource_type: 'subscription',
          metadata: {},
        })
      }

      return ctx.ok({ ok: true })
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
