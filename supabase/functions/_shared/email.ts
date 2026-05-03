export function buildInviteEmailMessage({
  appBaseUrl,
  from,
  inviteeEmail,
  invitedByEmail,
  tenantName,
  role,
  token,
}: {
  appBaseUrl: string
  from: string
  inviteeEmail: string
  invitedByEmail: string
  tenantName: string
  role: string
  token: string
}) {
  const acceptUrl = `${appBaseUrl.replace(/\/+$/, '')}/?invite=${encodeURIComponent(token)}`
  const subject = `Convite para ${tenantName} no NexusCRM`
  const text = [
    `Voce recebeu um convite para entrar no workspace ${tenantName} no NexusCRM.`,
    `Role sugerida: ${role}.`,
    `Convite enviado por: ${invitedByEmail}.`,
    `Aceite aqui: ${acceptUrl}`,
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="margin-bottom:12px">Convite para o NexusCRM</h1>
      <p>Voce recebeu um convite para entrar no workspace <strong>${tenantName}</strong>.</p>
      <p>Role sugerida: <strong>${role}</strong>.</p>
      <p>Convite enviado por: <strong>${invitedByEmail}</strong>.</p>
      <p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px">
          Aceitar convite
        </a>
      </p>
      <p style="font-size:14px;color:#6b7280">Se o botao nao abrir, use este link: ${acceptUrl}</p>
    </div>
  `.trim()

  return {
    from,
    to: [inviteeEmail],
    subject,
    html,
    text,
    tags: [
      { name: 'flow', value: 'membership-invite' },
      { name: 'tenant', value: tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64) || 'workspace' },
    ],
  }
}

function getAppBaseUrl() {
  return (
    Deno.env.get('APP_URL')?.trim()
    || Deno.env.get('SITE_URL')?.trim()
    || Deno.env.get('ALLOWED_APP_ORIGIN')?.split(',')[0]?.trim()
    || ''
  )
}

function getEmailProviders() {
  const primaryApiKey = Deno.env.get('RESEND_API_KEY')?.trim() || ''
  const primaryFrom = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || ''
  const backupApiKey = Deno.env.get('RESEND_BACKUP_API_KEY')?.trim() || ''
  const backupFrom = Deno.env.get('RESEND_BACKUP_FROM_EMAIL')?.trim() || ''

  const providers = []
  if (primaryApiKey && primaryFrom) {
    providers.push({
      name: 'resend',
      apiKey: primaryApiKey,
      from: primaryFrom,
      retries: 2,
    })
  }

  if (backupApiKey && backupFrom) {
    providers.push({
      name: 'resend-backup',
      apiKey: backupApiKey,
      from: backupFrom,
      retries: 1,
    })
  }

  return providers
}

async function sendViaResend({
  apiKey,
  payload,
  providerName,
  token,
}: {
  apiKey: string
  payload: ReturnType<typeof buildInviteEmailMessage>
  providerName: string
  token: string
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `invite-${providerName}-${token}`,
    },
    body: JSON.stringify(payload),
  })

  let data: Record<string, unknown> | null = null
  try {
    data = await response.json() as Record<string, unknown>
  } catch {
    data = null
  }

  if (!response.ok) {
    return {
      sent: false,
      provider: providerName,
      reason: data?.message ?? `resend_${response.status}`,
      responseStatus: response.status,
      retryable: response.status >= 500 || response.status === 429,
      emailId: null,
    }
  }

  return {
    sent: true,
    provider: providerName,
    reason: null,
    responseStatus: response.status,
    retryable: false,
    emailId: typeof data?.id === 'string' ? data.id : null,
  }
}

export async function sendInviteEmail({
  inviteeEmail,
  invitedByEmail,
  tenantName,
  role,
  token,
}: {
  inviteeEmail: string
  invitedByEmail: string
  tenantName: string
  role: string
  token: string
}) {
  const appBaseUrl = getAppBaseUrl()
  const providers = getEmailProviders()

  if (!appBaseUrl || providers.length === 0) {
    return {
      sent: false,
      skipped: true,
      provider: providers[0]?.name ?? 'resend',
      reason: 'email_provider_not_configured',
      attempts: [],
    }
  }

  const attempts = []

  for (const provider of providers) {
    const payload = buildInviteEmailMessage({
      appBaseUrl,
      from: provider.from,
      inviteeEmail,
      invitedByEmail,
      tenantName,
      role,
      token,
    })

    for (let attempt = 1; attempt <= provider.retries + 1; attempt += 1) {
      const delivery = await sendViaResend({
        apiKey: provider.apiKey,
        payload,
        providerName: provider.name,
        token,
      })

      attempts.push({
        provider: provider.name,
        attempt,
        sent: delivery.sent,
        reason: delivery.reason,
        responseStatus: delivery.responseStatus,
      })

      if (delivery.sent) {
        return {
          sent: true,
          skipped: false,
          provider: provider.name,
          emailId: delivery.emailId,
          attempts,
        }
      }

      if (!delivery.retryable) {
        break
      }
    }
  }

  const lastAttempt = attempts[attempts.length - 1] ?? null
  return {
    sent: false,
    skipped: false,
    provider: lastAttempt?.provider ?? providers[0].name,
    reason: lastAttempt?.reason ?? 'email_delivery_failed',
    responseStatus: lastAttempt?.responseStatus ?? null,
    attempts,
  }
}
