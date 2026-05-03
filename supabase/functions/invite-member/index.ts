import { json, preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { getUserSupabaseClient } from '../_shared/supabase.ts'
import { requireTenantAccess } from '../_shared/tenant.ts'
import { writeAuditLog } from '../_shared/audit.ts'
import { sendInviteEmail } from '../_shared/email.ts'
import { attachRequestId, createRequestContext } from '../_shared/observability.ts'

function getRouteParts(req: Request) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf('invite-member')
  return {
    routeParts: index >= 0 ? parts.slice(index + 1) : [],
  }
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function parseRole(value: unknown) {
  const role = String(value ?? '').trim().toLowerCase()
  return role
}

function parseStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase()
  return status
}

function mapErrorStatus(message: string) {
  if (message.includes('limit')) return 409
  if (message.includes('forbidden') || message.includes('mismatch')) return 403
  if (
    message.includes('required') ||
    message.includes('invalid') ||
    message.includes('locked') ||
    message.includes('last_owner') ||
    message.includes('self_') ||
    message.includes('not_found') ||
    message.includes('already_member') ||
    message.includes('expired')
  ) {
    return 400
  }

  return 500
}

function normalizeRpcError(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : fallbackMessage
  return {
    error: message,
    status: mapErrorStatus(message),
  }
}

Deno.serve(async (req: Request) => {
  const ctx = createRequestContext(req, 'invite-member')
  const request = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (request.method === 'OPTIONS') {
    return preflight(request, 'GET, POST, PATCH, DELETE, OPTIONS')
  }

  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const sb = getUserSupabaseClient(request)
  const { routeParts } = getRouteParts(request)
  const resource = routeParts[0] ?? null
  const resourceId = routeParts[1] ?? null
  const subresource = routeParts[2] ?? null
  const memberId = routeParts[3] ?? null
  const action = routeParts[4] ?? null

  try {
    if (request.method === 'POST' && resource === 'accept' && !resourceId) {
      const body = toRecord(await request.json())
      const token = String(body.token ?? '').trim()

      if (!token) {
        return ctx.fail(400, 'invite_token_required', 'Token de convite obrigatorio.')
      }

      const { data, error } = await sb.rpc('accept_invitation', {
        p_actor_user_id: auth.user.id,
        p_token: token,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao aceitar convite.')
        return ctx.fail(normalized.status, 'invitation_accept_failed', normalized.error)
      }

      const item = Array.isArray(data) ? data[0] ?? null : data
      if (item?.tenant_id) {
        await writeAuditLog({
          tenantId: item.tenant_id,
          userId: auth.user.id,
          action: 'membership.invite_accepted',
          resourceType: 'invitation',
          resourceId: item.invitation_id ?? null,
          metadata: {
            membership_id: item.membership_id ?? null,
            role: item.role ?? null,
          },
        })
      }

      ctx.log('info', 'invitation_accepted', {
        user_id: auth.user.id,
        tenant_id: item?.tenant_id ?? null,
        membership_id: item?.membership_id ?? null,
      })
      return ctx.ok({ item }, 200)
    }

    if (!resource || resource !== 'tenants' || !resourceId) {
      return ctx.fail(405, 'method_not_allowed', 'Method not allowed')
    }

    const tenantAccess = await requireTenantAccess(request, auth.user.id)
    if (!tenantAccess.ok) return tenantAccess.response

    if (tenantAccess.tenantId !== resourceId) {
      return ctx.fail(400, 'tenant_path_header_mismatch', 'Tenant id do path difere do header.')
    }

    if (request.method === 'GET' && subresource === 'members' && !memberId) {
      const { data, error } = await sb.rpc('list_tenant_members', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao listar membros.')
        return ctx.fail(normalized.status, 'members_list_failed', normalized.error)
      }

      return ctx.ok({ items: data ?? [] })
    }

    if (request.method === 'GET' && subresource === 'invitations' && !memberId) {
      const { data, error } = await sb.rpc('list_tenant_invitations', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao listar convites.')
        return ctx.fail(normalized.status, 'invitations_list_failed', normalized.error)
      }

      return ctx.ok({ items: data ?? [] })
    }

    if (request.method === 'POST' && subresource === 'invitations' && !memberId) {
      const body = toRecord(await request.json())
      const email = String(body.email ?? '').trim()
      const role = parseRole(body.role)

      if (!email) return ctx.fail(400, 'invite_email_required', 'Email do convidado obrigatorio.')
      if (!role) return ctx.fail(400, 'invite_role_required', 'Role do convite obrigatoria.')

      const { data, error } = await sb.rpc('create_invitation', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
        p_email: email,
        p_role: role,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao criar convite.')
        return ctx.fail(normalized.status, 'invitation_create_failed', normalized.error)
      }

      const invitation = Array.isArray(data) ? data[0] ?? null : data
      const { data: tenant, error: tenantError } = await sb
        .from('tenants')
        .select('id, name')
        .eq('id', tenantAccess.tenantId)
        .single()

      if (tenantError) {
        return ctx.fail(500, 'tenant_fetch_failed', tenantError.message)
      }

      const delivery = invitation?.token
        ? await sendInviteEmail({
          inviteeEmail: invitation.email,
          invitedByEmail: auth.user.email ?? 'noreply@nexuscrm.local',
          tenantName: tenant.name,
          role: invitation.role,
          token: invitation.token,
        })
        : { sent: false, skipped: true, provider: 'resend', reason: 'invitation_token_missing' }

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: 'membership.invite_sent',
        resourceType: 'invitation',
        resourceId: invitation?.id ?? null,
        metadata: {
          email: invitation?.email ?? email,
          role: invitation?.role ?? role,
          delivery,
        },
      })

      ctx.log('info', 'invitation_created', {
        user_id: auth.user.id,
        tenant_id: tenantAccess.tenantId,
        invitation_id: invitation?.id ?? null,
        delivery_sent: delivery.sent ?? false,
        delivery_skipped: delivery.skipped ?? false,
      })

      return ctx.ok({ item: invitation, delivery }, 201)
    }

    if (request.method === 'PATCH' && subresource === 'members' && memberId && action === 'role') {
      const body = toRecord(await request.json())
      const role = parseRole(body.role)

      if (!role) return ctx.fail(400, 'membership_role_required', 'Role do membro obrigatoria.')

      const { data, error } = await sb.rpc('update_membership_role', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
        p_membership_id: memberId,
        p_role: role,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao atualizar role do membro.')
        return ctx.fail(normalized.status, 'membership_role_update_failed', normalized.error)
      }

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: 'membership.role_updated',
        resourceType: 'membership',
        resourceId: memberId,
        metadata: {
          role: (data as { role?: string } | null)?.role ?? role,
        },
      })

      return ctx.ok({ item: data }, 200)
    }

    if (request.method === 'PATCH' && subresource === 'members' && memberId && action === 'status') {
      const body = toRecord(await request.json())
      const status = parseStatus(body.status)

      if (!status) return ctx.fail(400, 'membership_status_required', 'Status do membro obrigatorio.')

      const { data, error } = await sb.rpc('set_membership_status', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
        p_membership_id: memberId,
        p_status: status,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao atualizar status do membro.')
        return ctx.fail(normalized.status, 'membership_status_update_failed', normalized.error)
      }

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: status === 'suspended' ? 'membership.suspended' : 'membership.reactivated',
        resourceType: 'membership',
        resourceId: memberId,
        metadata: {
          status: (data as { status?: string } | null)?.status ?? status,
        },
      })

      return ctx.ok({ item: data }, 200)
    }

    if (request.method === 'DELETE' && subresource === 'members' && memberId && !action) {
      const { data, error } = await sb.rpc('remove_membership', {
        p_actor_user_id: auth.user.id,
        p_tenant_id: tenantAccess.tenantId,
        p_membership_id: memberId,
      })

      if (error) {
        const normalized = normalizeRpcError(error, 'Erro ao remover membro.')
        return ctx.fail(normalized.status, 'membership_remove_failed', normalized.error)
      }

      await writeAuditLog({
        tenantId: tenantAccess.tenantId,
        userId: auth.user.id,
        action: 'membership.removed',
        resourceType: 'membership',
        resourceId: memberId,
        metadata: {
          removed_membership_id: data ?? memberId,
        },
      })

      return ctx.ok({ membershipId: data }, 200)
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
