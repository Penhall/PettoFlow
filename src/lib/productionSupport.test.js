import { describe, expect, it, vi } from 'vitest'
import { buildAuditLogPayload } from '../../supabase/functions/_shared/audit-utils.ts'
import { buildInviteEmailMessage } from '../../supabase/functions/_shared/email.ts'
import { createRequestContext } from '../../supabase/functions/_shared/observability.ts'
import { normalizePlanLimits, resolveLimitExceededMessage } from '../../supabase/functions/_shared/limit-utils.ts'
import { getStripeSubscriptionInterval, mapStripeSubscriptionStatus } from '../../supabase/functions/_shared/stripe.ts'

describe('production support helpers', () => {
  it('builds a resend-compatible invitation email payload', () => {
    const payload = buildInviteEmailMessage({
      appBaseUrl: 'https://app.nexuscrm.example',
      from: 'NexusCRM <noreply@nexuscrm.example>',
      inviteeEmail: 'user@example.com',
      invitedByEmail: 'owner@example.com',
      tenantName: 'Workspace Alpha',
      role: 'member',
      token: 'invite-token-123',
    })

    expect(payload.to).toEqual(['user@example.com'])
    expect(payload.subject).toContain('Workspace Alpha')
    expect(payload.html).toContain('invite=invite-token-123')
    expect(payload.text).toContain('https://app.nexuscrm.example/?invite=invite-token-123')
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'flow', value: 'membership-invite' }),
      ]),
    )
  })

  it('normalizes audit log payloads for persistent storage', () => {
    expect(buildAuditLogPayload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'membership.invite_sent',
      resourceType: 'invitation',
      resourceId: 42,
      metadata: { role: 'member' },
    })).toEqual({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      action: 'membership.invite_sent',
      resource_type: 'invitation',
      resource_id: '42',
      metadata: { role: 'member' },
    })
  })

  it('reuses x-request-id when present', () => {
    const req = new Request('https://example.com/functions/v1/test', {
      headers: { 'x-request-id': 'req-123' },
    })

    const context = createRequestContext(req, 'test-scope')

    expect(context.requestId).toBe('req-123')
    expect(context.scope).toBe('test-scope')
  })

  it('generates a request id when header is absent', () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-id')
    const req = new Request('https://example.com/functions/v1/test')

    const context = createRequestContext(req, 'test-scope')

    expect(context.requestId).toBe('generated-id')
    randomUUID.mockRestore()
  })

  it('normalizes partially configured limits with defaults', () => {
    const limits = normalizePlanLimits({ max_users: '10', max_tasks: 250 })

    expect(limits).toEqual({
      max_users: 10,
      max_clients: null,
      max_tasks: 250,
      max_activities: null,
      max_transactions: null,
    })
  })

  it('returns domain-specific messages for known quota keys', () => {
    expect(resolveLimitExceededMessage('max_users')).toContain('usuarios')
    expect(resolveLimitExceededMessage('max_clients')).toContain('clientes')
    expect(resolveLimitExceededMessage('max_tasks')).toContain('tarefas')
    expect(resolveLimitExceededMessage('max_activities')).toContain('atividades')
    expect(resolveLimitExceededMessage('max_transactions')).toContain('transacoes')
  })

  it('maps Stripe subscription status and interval to local billing semantics', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active')
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('paused')).toBe('inactive')

    expect(getStripeSubscriptionInterval({
      items: {
        data: [{
          price: {
            recurring: { interval: 'year' },
          },
        }],
      },
    })).toBe('yearly')
  })
})
