import { getServiceRoleClient } from './supabase.ts';
import { normalizePlanLimits, resolveLimitExceededMessage } from './limit-utils.ts';
export { resolveLimitExceededMessage } from './limit-utils.ts';
const DEFAULT_LIMITS = {
  max_users: null,
  max_clients: null,
  max_tasks: null,
  max_activities: null,
  max_transactions: null
};
export async function fetchTenantPlanLimits(tenantId) {
  const sb = getServiceRoleClient();
  const { data, error } = await sb.rpc('get_tenant_effective_limits', {
    p_tenant_id: tenantId
  });
  if (error) throw error;
  return normalizePlanLimits(data ?? DEFAULT_LIMITS);
}
export async function assertTenantLimit(tenantId, metric, nextValue) {
  const limits = await fetchTenantPlanLimits(tenantId);
  const limitValue = limits[metric];
  if (limitValue !== null && nextValue > limitValue) {
    const error = new Error(resolveLimitExceededMessage(metric));
    error.name = 'TenantLimitExceededError';
    error.code = metric;
    throw error;
  }
}
