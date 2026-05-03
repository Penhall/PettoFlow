export function buildAuditLogPayload(event: {
  tenantId: string | null
  userId: string | null
  action: string
  resourceType: string
  resourceId?: string | number | null
  metadata?: Record<string, unknown>
}) {
  return {
    tenant_id: event.tenantId,
    user_id: event.userId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId === undefined || event.resourceId === null ? null : String(event.resourceId),
    metadata: event.metadata ?? {},
  }
}
