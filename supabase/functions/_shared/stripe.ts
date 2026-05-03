const STRIPE_API_URL = 'https://api.stripe.com/v1'

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY')?.trim() || ''
}

function getStripeWebhookSecret() {
  return Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim() || ''
}

function getAppBaseUrl() {
  return (
    Deno.env.get('APP_URL')?.trim()
    || Deno.env.get('SITE_URL')?.trim()
    || Deno.env.get('ALLOWED_APP_ORIGIN')?.split(',')[0]?.trim()
    || ''
  )
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey() && getAppBaseUrl())
}

function encodeFormBody(payload: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    body.set(key, String(value))
  })
  return body
}

async function stripeRequest(
  path: string,
  payload: Record<string, string | number | boolean | null | undefined>,
  idempotencyKey?: string,
) {
  const apiKey = getStripeSecretKey()
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY nao configurada.')
  }

  const response = await fetch(`${STRIPE_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: encodeFormBody(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string'
      ? data.error.message
      : `stripe_${response.status}`
    throw new Error(message)
  }

  return data as Record<string, unknown>
}

export async function createStripeCustomer({
  tenantId,
  tenantName,
  email,
}: {
  tenantId: string
  tenantName: string
  email: string
}) {
  return stripeRequest('/customers', {
    email,
    name: tenantName,
    'metadata[tenant_id]': tenantId,
    'metadata[source]': 'nexuscrm',
  }, `tenant-customer-${tenantId}`)
}

export async function createStripeCheckoutSession({
  tenantId,
  tenantName,
  customerId,
  priceId,
  interval,
}: {
  tenantId: string
  tenantName: string
  customerId: string
  priceId: string
  interval: 'monthly' | 'yearly'
}) {
  const appBaseUrl = getAppBaseUrl()
  if (!appBaseUrl) {
    throw new Error('APP_URL ou SITE_URL nao configurada para billing.')
  }

  return stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    customer: customerId,
    success_url: `${appBaseUrl.replace(/\/+$/, '')}/?tab=settings&settingsTab=billing&billing=success`,
    cancel_url: `${appBaseUrl.replace(/\/+$/, '')}/?tab=settings&settingsTab=billing&billing=cancel`,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    'allow_promotion_codes': true,
    'metadata[tenant_id]': tenantId,
    'metadata[tenant_name]': tenantName,
    'metadata[billing_interval]': interval,
    'subscription_data[metadata][tenant_id]': tenantId,
    'subscription_data[metadata][billing_interval]': interval,
  }, `tenant-checkout-${tenantId}-${priceId}-${interval}`)
}

export async function createStripeBillingPortalSession({
  customerId,
}: {
  customerId: string
}) {
  const appBaseUrl = getAppBaseUrl()
  if (!appBaseUrl) {
    throw new Error('APP_URL ou SITE_URL nao configurada para billing.')
  }

  return stripeRequest('/billing_portal/sessions', {
    customer: customerId,
    return_url: `${appBaseUrl.replace(/\/+$/, '')}/?tab=settings&settingsTab=billing&billing=portal`,
  }, `tenant-portal-${customerId}`)
}

function parseStripeSignature(header: string) {
  const parts = header.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || ''
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean)

  return { timestamp, signatures }
}

async function computeStripeSignature(secret: string, signedPayload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

export async function verifyStripeWebhookSignature(rawBody: string, header: string) {
  const secret = getStripeWebhookSecret()
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET nao configurada.')
  }

  const { timestamp, signatures } = parseStripeSignature(header)
  if (!timestamp || signatures.length === 0) {
    throw new Error('Assinatura Stripe ausente ou invalida.')
  }

  const expectedSignature = await computeStripeSignature(secret, `${timestamp}.${rawBody}`)
  const isValid = signatures.some((signature) => timingSafeEqual(signature, expectedSignature))
  if (!isValid) {
    throw new Error('Assinatura Stripe invalida.')
  }
}

export function mapStripeSubscriptionStatus(status: string | null | undefined) {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return 'inactive'
  }
}

export function getStripeSubscriptionPriceId(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined
  const firstItem = items?.data?.[0]
  const price = firstItem?.price as Record<string, unknown> | undefined
  return typeof price?.id === 'string' ? price.id : null
}

export function getStripeSubscriptionInterval(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined
  const firstItem = items?.data?.[0]
  const price = firstItem?.price as Record<string, unknown> | undefined
  const recurring = price?.recurring as Record<string, unknown> | undefined
  const interval = typeof recurring?.interval === 'string' ? recurring.interval : null
  return interval === 'year' ? 'yearly' : 'monthly'
}
