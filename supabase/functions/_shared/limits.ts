import { getServiceRoleClient } from './supabase.ts'
import { normalizePlanLimits, resolveLimitExceededMessage, type PlanLimits } from './limit-utils.ts'

const DEFAULT_LIMITS: PlanLimits = {
  max_users: null,
  max_clients: null,
  max_tasks: null,
  max_activities: null,
  max_transactions: null,
}

export async function fetchTenantPlanLimits(tenantId: string) {
  const sb = getServiceRoleClient()
  const { data, error } = await sb.rpc('get_tenant_effective_limits', {
    p_tenant_id: tenantId,
  })

  if (error) throw error

  return normalizePlanLimits((data as Record<string, unknown> | null | undefined) ?? DEFAULT_LIMITS)
}

export async function assertTenantLimit(tenantId: string, metric: keyof PlanLimits, nextValue: number) {
  const limits = await fetchTenantPlanLimits(tenantId)
  const limitValue = limits[metric]

  if (limitValue !== null && nextValue > limitValue) {
    const error = new Error(resolveLimitExceededMessage(metric))
    error.name = 'TenantLimitExceededError'
    ;(error as Error & { code?: string }).code = metric
    throw error
  }
}
