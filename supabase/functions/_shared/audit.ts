import { getServiceRoleClient } from './supabase.ts'
import { buildAuditLogPayload } from './audit-utils.ts'

type AuditEvent = {
  tenantId: string | null
  userId: string | null
  action: string
  resourceType: string
  resourceId?: string | number | null
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(event: AuditEvent) {
  const sb = getServiceRoleClient()
  const { error } = await sb
    .from('audit_logs')
    .insert([buildAuditLogPayload(event)])

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'audit_log_failed',
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      error: error.message,
    }))
  }
}
