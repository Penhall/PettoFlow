import { preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceRoleClient, getUserSupabaseClient } from '../_shared/supabase.ts'
import { requireTenantAccess } from '../_shared/tenant.ts'
import { writeAuditLog } from '../_shared/audit.ts'
import {
  getTenantSubscription,
  getTenantUsageSnapshot,
  listActivePlans,
  updateTenantSubscription,
} from '../_shared/billing.ts'
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  createStripeCustomer,
  isStripeConfigured,
} from '../_shared/stripe.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'

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

function canManageBilling(role: string | null | undefined) {
  return role === 'owner' || role === 'admin'
}

function normalizeSubscription(subscription: Record<string, unknown> | null) {
  if (!subscription) return null

  const plan = toRecord(subscription.plan)
  return {
    id: subscription.id ?? null,
    tenantId: subscription.tenant_id ?? null,
    status: subscription.status ?? null,
    provider: subscription.provider ?? null,
    billingInterval: subscription.billing_interval ?? 'monthly',
    currentPeriodStart: subscription.current_period_start ?? null,
    currentPeriodEnd: subscription.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    lastSyncedAt: subscription.last_synced_at ?? null,
    plan: plan.id
      ? {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description ?? null,
        limits: toRecord(plan.limits),
        priceMonthly: plan.price_monthly ?? null,
        priceYearly: plan.price_yearly ?? null,
      }
      : null,
  }
}

function normalizePlan(plan: Record<string, unknown>) {
  return {
    id: plan.id ?? null,
    name: plan.name ?? null,
    slug: plan.slug ?? null,
    description: plan.description ?? null,
    limits: toRecord(plan.limits),
    priceMonthly: plan.price_monthly ?? null,
    priceYearly: plan.price_yearly ?? null,
    monthlyAvailable: Boolean(plan.stripe_price_monthly_id),
    yearlyAvailable: Boolean(plan.stripe_price_yearly_id),
    displayOrder: plan.display_order ?? 0,
  }
}

function parseBillingInterval(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'yearly' ? 'yearly' : normalized === 'monthly' ? 'monthly' : null
}

Deno.serve(async (req: Request) => {
  const ctx = createRequestContext(req, 'tenant-core')
  const request = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (request.method === 'OPTIONS') return preflight(request, 'GET, POST, PATCH, OPTIONS')

  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const sb = getUserSupabaseClient(request)
  const serviceSb = getServiceRoleClient()
  const { url, routeParts } = getRouteParts(request)
  const resource = routeParts[0] ?? null
  const resourceId = routeParts[1] ?? null
  const action = routeParts[2] ?? null
  const subAction = routeParts[3] ?? null

  try {
    if (request.method === 'GET' && resource === 'tenants' && !resourceId) {
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

      if (error) return ctx.fail(500, 'tenant_list_failed', error.message)

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

      ctx.log('info', 'tenants_listed', { user_id: auth.user.id, tenant_count: items.length })
      return ctx.ok({ items })
    }

    if (request.method === 'POST' && resource === 'tenants' && !resourceId) {
      const body = toRecord(await request.json())
      const name = String(body.name ?? '').trim()
      const slug = String(body.slug ?? '').trim().toLowerCase()

      if (!name) return ctx.fail(400, 'tenant_name_required', 'Nome do workspace obrigatorio.')
      if (!slug) return ctx.fail(400, 'tenant_slug_required', 'Slug do workspace obrigatorio.')
      if (!isValidTenantSlug(slug)) {
        return ctx.fail(400, 'tenant_slug_invalid', 'Slug do workspace invalido.')
      }

      const { data: tenantId, error } = await sb.rpc('create_tenant_with_owner', {
        p_owner_user_id: auth.user.id,
        p_name: name,
        p_slug: slug,
      })

      if (error) {
        const message = error.message ?? 'Erro ao criar workspace.'
        const conflict = message.includes('already exists')
        return ctx.fail(conflict ? 409 : 500, conflict ? 'tenant_slug_conflict' : 'tenant_create_failed', message)
      }

      const { data: tenant, error: tenantError } = await sb
        .from('tenants')
        .select('id, name, slug, owner_user_id, created_at, updated_at')
        .eq('id', tenantId)
        .single()

      if (tenantError) return ctx.fail(500, 'tenant_fetch_failed', tenantError.message)

      const { data: membership, error: membershipError } = await sb
        .from('memberships')
        .select('id, role, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', auth.user.id)
        .single()

      if (membershipError) return ctx.fail(500, 'membership_fetch_failed', membershipError.message)

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

      if (settingsError) return ctx.fail(500, 'tenant_settings_upsert_failed', settingsError.message)

      await writeAuditLog({
        tenantId: tenant.id,
        userId: auth.user.id,
        action: 'tenant.created',
        resourceType: 'tenant',
        resourceId: tenant.id,
        metadata: {
          slug: tenant.slug,
          owner_user_id: tenant.owner_user_id,
        },
      })

      ctx.log('info', 'tenant_created', {
        user_id: auth.user.id,
        tenant_id: tenant.id,
        slug: tenant.slug,
      })

      return ctx.ok({
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

    if ((request.method === 'GET' || request.method === 'PATCH') && resource === 'tenants' && resourceId && action === 'settings') {
      const tenantAccess = await requireTenantAccess(request, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
      }

      if (request.method === 'GET') {
        const { data, error } = await sb
          .from('tenant_settings')
          .select('id, tenant_id, key, value, created_at, updated_at')
          .eq('tenant_id', tenantAccess.tenantId)
          .order('key', { ascending: true })

        if (error) return ctx.fail(500, 'tenant_settings_list_failed', error.message)
        return ctx.ok({ items: data ?? [] })
      }

      const body = toRecord(await request.json())
      const value = body.value

      const { data, error } = await sb
        .from('tenant_settings')
        .upsert(
          [{ tenant_id: tenantAccess.tenantId, key: 'workspace_profile', value: value ?? {} }],
          { onConflict: 'tenant_id,key' },
        )
        .select('id, tenant_id, key, value, created_at, updated_at')
        .single()

      if (error) return ctx.fail(500, 'tenant_settings_update_failed', error.message)
      return ctx.ok(data)
    }

    if (request.method === 'GET' && resource === 'tenants' && resourceId && action === 'billing') {
      const tenantAccess = await requireTenantAccess(request, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
      }

      const [subscription, usage, plans] = await Promise.all([
        getTenantSubscription(tenantAccess.tenantId),
        getTenantUsageSnapshot(tenantAccess.tenantId),
        listActivePlans(),
      ])

      return ctx.ok({
        manageable: canManageBilling(tenantAccess.membership.role),
        stripeConfigured: isStripeConfigured(),
        subscription: normalizeSubscription(subscription as Record<string, unknown> | null),
        usage,
        plans: plans.map((plan) => normalizePlan(plan as Record<string, unknown>)),
      })
    }

    if (request.method === 'POST' && resource === 'tenants' && resourceId && action === 'billing' && subAction === 'checkout') {
      const tenantAccess = await requireTenantAccess(request, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
      }
      if (!canManageBilling(tenantAccess.membership.role)) {
        return ctx.fail(403, 'billing_management_forbidden', 'Apenas owner/admin podem gerenciar billing.')
      }

      const body = toRecord(await request.json())
      const planSlug = String(body.planSlug ?? '').trim().toLowerCase()
      const interval = parseBillingInterval(body.interval)
      if (!planSlug) return ctx.fail(400, 'billing_plan_required', 'Plano obrigatorio.')
      if (!interval) return ctx.fail(400, 'billing_interval_invalid', 'Intervalo de billing invalido.')
      if (!isStripeConfigured()) {
        return ctx.fail(503, 'stripe_not_configured', 'Stripe ainda nao configurado neste ambiente.')
      }
      if (!auth.user.email) {
        return ctx.fail(400, 'billing_email_missing', 'Usuario autenticado sem email para billing.')
      }

      const [{ data: tenant, error: tenantError }, subscription, plans] = await Promise.all([
        sb.from('tenants').select('id, name, slug').eq('id', tenantAccess.tenantId).single(),
        getTenantSubscription(tenantAccess.tenantId),
        listActivePlans(),
      ])

      if (tenantError) return ctx.fail(500, 'tenant_fetch_failed', tenantError.message)

      const selectedPlan = plans.find((plan) => String(plan.slug).toLowerCase() === planSlug)
      if (!selectedPlan) return ctx.fail(404, 'billing_plan_not_found', 'Plano selecionado nao encontrado.')

      const priceId = interval === 'yearly'
        ? selectedPlan.stripe_price_yearly_id
        : selectedPlan.stripe_price_monthly_id

      if (!priceId) {
        return ctx.fail(409, 'billing_plan_not_linked', 'Plano selecionado ainda nao possui price id Stripe configurado.')
      }

      let customerId = typeof subscription?.provider_customer_id === 'string'
        ? subscription.provider_customer_id
        : null

      if (!customerId) {
        const customer = await createStripeCustomer({
          tenantId: tenantAccess.tenantId,
          tenantName: String(tenant.name),
          email: auth.user.email,
        })
        customerId = String(customer.id)
      }

      const checkout = await createStripeCheckoutSession({
        tenantId: tenantAccess.tenantId,
        tenantName: String(tenant.name),
        customerId,
        priceId: String(priceId),
        interval,
      })

      const updatedSubscription = await updateTenantSubscription(tenantAccess.tenantId, {
        provider: 'stripe',
        provider_customer_id: customerId,
        checkout_session_id: checkout.id,
        billing_interval: interval,
        metadata: {
          pending_plan_slug: selectedPlan.slug,
          pending_price_id: priceId,
        },
      })

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: 'billing.checkout_started',
        resourceType: 'subscription',
        resourceId: updatedSubscription.id,
        metadata: {
          plan_slug: selectedPlan.slug,
          interval,
          checkout_session_id: checkout.id,
        },
      })

      ctx.log('info', 'billing_checkout_created', {
        user_id: auth.user.id,
        tenant_id: tenantAccess.tenantId,
        plan_slug: selectedPlan.slug,
        interval,
      })

      return ctx.ok({
        url: checkout.url ?? null,
        sessionId: checkout.id ?? null,
      }, 201)
    }

    if (request.method === 'POST' && resource === 'tenants' && resourceId && action === 'billing' && subAction === 'portal') {
      const tenantAccess = await requireTenantAccess(request, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
      }
      if (!canManageBilling(tenantAccess.membership.role)) {
        return ctx.fail(403, 'billing_management_forbidden', 'Apenas owner/admin podem gerenciar billing.')
      }
      if (!isStripeConfigured()) {
        return ctx.fail(503, 'stripe_not_configured', 'Stripe ainda nao configurado neste ambiente.')
      }

      const subscription = await getTenantSubscription(tenantAccess.tenantId)
      const customerId = typeof subscription?.provider_customer_id === 'string'
        ? subscription.provider_customer_id
        : null

      if (!customerId) {
        return ctx.fail(409, 'billing_customer_missing', 'Nenhum cliente Stripe vinculado ao workspace.')
      }

      const portal = await createStripeBillingPortalSession({ customerId })

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: 'billing.portal_opened',
        resourceType: 'subscription',
        resourceId: subscription?.id ?? null,
        metadata: {
          provider_customer_id: customerId,
        },
      })

      return ctx.ok({
        url: portal.url ?? null,
      }, 201)
    }

    if (request.method === 'GET' && resource === 'tenants' && resourceId && action === 'audit-logs') {
      const tenantAccess = await requireTenantAccess(request, auth.user.id)
      if (!tenantAccess.ok) return tenantAccess.response
      if (tenantAccess.tenantId !== resourceId) {
        return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
      }
      if (!canManageBilling(tenantAccess.membership.role)) {
        return ctx.fail(403, 'audit_log_access_forbidden', 'Apenas owner/admin podem visualizar auditoria do tenant.')
      }

      const limit = Math.min(Number(url.searchParams.get('limit') ?? '50') || 50, 200)
      const actionFilter = String(url.searchParams.get('action') ?? '').trim()

      let query = serviceSb
        .from('audit_logs')
        .select('id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at')
        .eq('tenant_id', tenantAccess.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (actionFilter) {
        query = query.ilike('action', `${actionFilter}%`)
      }

      const { data, error } = await query
      if (error) return ctx.fail(500, 'audit_logs_list_failed', error.message)
      return ctx.ok({ items: data ?? [] })
    }

    return ctx.fail(405, 'method_not_allowed', 'Method not allowed')
  } catch (err) {
    ctx.log('error', 'request_crashed', {
      error: err instanceof Error ? err.message : 'Internal server error',
      user_id: auth.user.id,
    })
    return ctx.fail(500, 'internal_server_error', err instanceof Error ? err.message : 'Internal server error')
  }
})
