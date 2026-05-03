import { getServiceRoleClient } from './supabase.ts'

export async function recordBillingEvent({
  provider,
  eventId,
  eventType,
  tenantId = null,
  subscriptionId = null,
  status = 'received',
  payload = {},
  errorMessage = null,
  requestId = null,
  processedAt = null,
}: {
  provider: string
  eventId: string
  eventType: string
  tenantId?: string | null
  subscriptionId?: string | null
  status?: 'received' | 'processed' | 'failed' | 'ignored'
  payload?: Record<string, unknown>
  errorMessage?: string | null
  requestId?: string | null
  processedAt?: string | null
}) {
  const sb = getServiceRoleClient()

  const { data, error } = await sb
    .from('billing_events')
    .upsert([{
      provider,
      event_id: eventId,
      event_type: eventType,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      status,
      payload,
      error_message: errorMessage,
      request_id: requestId,
      processed_at: processedAt,
    }], { onConflict: 'provider,event_id' })
    .select('id, provider, event_id, event_type, tenant_id, subscription_id, status, created_at, processed_at')
    .single()

  if (error) throw error
  return data
}

export async function getPlanBySlug(slug: string) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error) throw error
  return data
}

export async function getPlanByStripePriceId(priceId: string) {
  const sb = getServiceRoleClient()

  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('active', true)
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function listActivePlans() {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getTenantSubscription(tenantId: string) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('subscriptions')
    .select(`
      *,
      plan:plans (*)
    `)
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function updateTenantSubscription(tenantId: string, updates: Record<string, unknown>) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('subscriptions')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      plan:plans (*)
    `)
    .single()

  if (error) throw error
  return data
}

export async function updateSubscriptionByProviderId(providerSubscriptionId: string, updates: Record<string, unknown>) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb
    .from('subscriptions')
    .update(updates)
    .eq('provider_subscription_id', providerSubscriptionId)
    .select(`
      *,
      plan:plans (*)
    `)
    .single()

  if (error) throw error
  return data
}

export async function getTenantUsageSnapshot(tenantId: string) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb.rpc('get_tenant_usage_snapshot', {
    p_tenant_id: tenantId,
  })

  if (error) throw error
  return (data as Record<string, unknown> | null) ?? {}
}
