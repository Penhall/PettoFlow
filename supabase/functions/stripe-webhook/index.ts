import { json, preflight } from '../_shared/cors.ts'
import { writeAuditLog } from '../_shared/audit.ts'
import {
  getPlanByStripePriceId,
  getTenantSubscription,
  recordBillingEvent,
  updateSubscriptionByProviderId,
  updateTenantSubscription,
} from '../_shared/billing.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import {
  getStripeSubscriptionInterval,
  getStripeSubscriptionPriceId,
  mapStripeSubscriptionStatus,
  verifyStripeWebhookSignature,
} from '../_shared/stripe.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function unixToIso(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return new Date(numeric * 1000).toISOString()
}

async function findSubscriptionByProviderIds(providerSubscriptionId: string | null, providerCustomerId: string | null) {
  const serviceSb = getServiceRoleClient()

  if (providerSubscriptionId) {
    const { data, error } = await serviceSb
      .from('subscriptions')
      .select('*')
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle()

    if (error) throw error
    if (data) return data
  }

  if (providerCustomerId) {
    const { data, error } = await serviceSb
      .from('subscriptions')
      .select('*')
      .eq('provider_customer_id', providerCustomerId)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  }

  return null
}

async function handleCheckoutSessionCompleted(session: Record<string, unknown>) {
  const metadata = toRecord(session.metadata)
  const tenantId = typeof metadata.tenant_id === 'string' ? metadata.tenant_id : null
  const checkoutSessionId = typeof session.id === 'string' ? session.id : null
  const providerCustomerId = typeof session.customer === 'string' ? session.customer : null
  const providerSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null
  const billingInterval = typeof metadata.billing_interval === 'string' ? metadata.billing_interval : 'monthly'

  if (!tenantId) {
    return { tenantId: null, subscriptionId: null, ignored: true }
  }

  const updated = await updateTenantSubscription(tenantId, {
    provider: 'stripe',
    provider_customer_id: providerCustomerId,
    provider_subscription_id: providerSubscriptionId,
    checkout_session_id: checkoutSessionId,
    billing_interval: billingInterval,
    status: 'active',
    last_synced_at: new Date().toISOString(),
    metadata: {
      stripe_checkout_completed: true,
      stripe_checkout_session_id: checkoutSessionId,
    },
  })

  await writeAuditLog({
    tenantId,
    userId: null,
    action: 'billing.checkout_completed',
    resourceType: 'subscription',
    resourceId: updated.id,
    metadata: {
      checkout_session_id: checkoutSessionId,
      provider_subscription_id: providerSubscriptionId,
    },
  })

  return { tenantId, subscriptionId: updated.id, ignored: false }
}

async function handleSubscriptionSnapshot(subscription: Record<string, unknown>, deleted = false) {
  const metadata = toRecord(subscription.metadata)
  const providerSubscriptionId = typeof subscription.id === 'string' ? subscription.id : null
  const providerCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null
  const tenantIdFromMetadata = typeof metadata.tenant_id === 'string' ? metadata.tenant_id : null
  const currentSubscription = await findSubscriptionByProviderIds(providerSubscriptionId, providerCustomerId)
  const tenantId = tenantIdFromMetadata ?? currentSubscription?.tenant_id ?? null

  if (!tenantId) {
    return { tenantId: null, subscriptionId: null, ignored: true }
  }

  const priceId = getStripeSubscriptionPriceId(subscription)
  const plan = priceId ? await getPlanByStripePriceId(priceId) : null
  const currentTenantSubscription = currentSubscription ?? await getTenantSubscription(tenantId)
  const status = mapStripeSubscriptionStatus(deleted ? 'canceled' : String(subscription.status ?? 'inactive'))
  const interval = getStripeSubscriptionInterval(subscription)

  const updates = {
    provider: 'stripe',
    provider_customer_id: providerCustomerId,
    provider_subscription_id: providerSubscriptionId,
    plan_id: plan?.id ?? currentTenantSubscription?.plan_id ?? null,
    status,
    billing_interval: interval,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_start: unixToIso(subscription.current_period_start),
    current_period_end: unixToIso(subscription.current_period_end),
    last_synced_at: new Date().toISOString(),
    metadata: {
      stripe_status: subscription.status ?? null,
      stripe_price_id: priceId,
    },
  }

  const updated = providerSubscriptionId && currentSubscription?.provider_subscription_id
    ? await updateSubscriptionByProviderId(providerSubscriptionId, updates)
    : await updateTenantSubscription(tenantId, updates)

  await writeAuditLog({
    tenantId,
    userId: null,
    action: 'billing.subscription_synced',
    resourceType: 'subscription',
    resourceId: updated.id,
    metadata: {
      status,
      stripe_status: subscription.status ?? null,
      provider_subscription_id: providerSubscriptionId,
      provider_customer_id: providerCustomerId,
      price_id: priceId,
    },
  })

  return { tenantId, subscriptionId: updated.id, ignored: false }
}

Deno.serve(async (req: Request) => {
  const ctx = createRequestContext(req, 'stripe-webhook')
  const request = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (request.method === 'OPTIONS') return preflight(request, 'POST, OPTIONS')
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405)

  let rawBody = ''
  let eventId = ''
  let eventType = ''

  try {
    rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')?.trim() || ''
    await verifyStripeWebhookSignature(rawBody, signature)

    const event = JSON.parse(rawBody) as Record<string, unknown>
    eventId = String(event.id ?? '')
    eventType = String(event.type ?? '')
    const existing = await getServiceRoleClient()
      .from('billing_events')
      .select('id, status')
      .eq('provider', 'stripe')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existing.error) {
      return json(request, { error: existing.error.message }, 500)
    }

    if (existing.data?.status === 'processed') {
      return json(request, { ok: true, duplicate: true })
    }

    const object = toRecord(toRecord(event.data).object)
    const metadata = toRecord(object.metadata)
    const tenantIdHint = typeof metadata.tenant_id === 'string' ? metadata.tenant_id : null

    await recordBillingEvent({
      provider: 'stripe',
      eventId,
      eventType,
      tenantId: tenantIdHint,
      status: 'received',
      payload: event,
      requestId: ctx.requestId,
    })

    let result: { tenantId: string | null, subscriptionId: string | null, ignored: boolean } = {
      tenantId: tenantIdHint,
      subscriptionId: null,
      ignored: false,
    }

    if (eventType === 'checkout.session.completed') {
      result = await handleCheckoutSessionCompleted(object)
    } else if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
      result = await handleSubscriptionSnapshot(object, false)
    } else if (eventType === 'customer.subscription.deleted') {
      result = await handleSubscriptionSnapshot(object, true)
    } else {
      result = {
        tenantId: tenantIdHint,
        subscriptionId: null,
        ignored: true,
      }
    }

    await recordBillingEvent({
      provider: 'stripe',
      eventId,
      eventType,
      tenantId: result.tenantId,
      subscriptionId: result.subscriptionId,
      status: result.ignored ? 'ignored' : 'processed',
      payload: event,
      requestId: ctx.requestId,
      processedAt: new Date().toISOString(),
    })

    ctx.log('info', 'stripe_event_processed', {
      event_id: eventId,
      event_type: eventType,
      tenant_id: result.tenantId,
      subscription_id: result.subscriptionId,
      ignored: result.ignored,
    })

    return json(request, { ok: true })
  } catch (error) {
    if (eventId && eventType) {
      await recordBillingEvent({
        provider: 'stripe',
        eventId,
        eventType,
        status: 'failed',
        payload: rawBody ? { raw_body_present: true } : {},
        errorMessage: error instanceof Error ? error.message : 'Erro ao processar webhook Stripe.',
        requestId: ctx.requestId,
        processedAt: new Date().toISOString(),
      }).catch(() => {})
    }

    ctx.log('error', 'stripe_event_failed', {
      event_id: eventId || null,
      event_type: eventType || null,
      error: error instanceof Error ? error.message : 'Erro ao processar webhook Stripe.',
    })

    return json(request, {
      error: error instanceof Error ? error.message : 'Erro ao processar webhook Stripe.',
      request_id: ctx.requestId,
    }, 400, { 'X-Request-Id': ctx.requestId })
  }
})
