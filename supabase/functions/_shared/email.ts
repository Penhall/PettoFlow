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

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

function getEmailProviders() {
  const primaryApiKey = Deno.env.get('RESEND_API_KEY')?.trim() || ''
  const primaryFrom = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || ''
  const backupApiKey = Deno.env.get('RESEND_BACKUP_API_KEY')?.trim() || ''
  const backupFrom = Deno.env.get('RESEND_BACKUP_FROM_EMAIL')?.trim() || ''

  const smtpHost = Deno.env.get('SMTP_HOST')?.trim() || ''
  const smtpPort = Deno.env.get('SMTP_PORT')?.trim() || ''
  const smtpUser = Deno.env.get('SMTP_USER')?.trim() || ''
  const smtpPass = Deno.env.get('SMTP_PASS')?.trim() || ''
  const smtpFrom = Deno.env.get('SMTP_FROM')?.trim() || ''

  // Prefer Resend when configured, fall back to SMTP
  if (primaryApiKey && primaryFrom) {
    const providers: Array<{ name: string; provider: 'resend'; apiKey: string; from: string; retries: number }> = [
      { name: 'resend', provider: 'resend', apiKey: primaryApiKey, from: primaryFrom, retries: 2 },
    ]
    if (backupApiKey && backupFrom) {
      providers.push({
        name: 'resend-backup',
        provider: 'resend',
        apiKey: backupApiKey,
        from: backupFrom,
        retries: 1,
      })
    }
    if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
      providers.push({
        name: 'smtp-fallback',
        provider: 'resend',
        apiKey: '',
        from: smtpFrom,
        retries: 1,
      })
    }
    return providers
  }

  // No Resend — use SMTP directly
  if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
    return [
      {
        name: 'smtp',
        provider: 'smtp' as const,
        host: smtpHost,
        port: parseInt(smtpPort, 10) || 587,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
        retries: 2,
      },
    ]
  }

  return []
}

// ---------------------------------------------------------------------------
// SMTP sender (raw protocol via Deno.connectTls, port 465 or STARTTLS 587)
// ---------------------------------------------------------------------------

async function sendViaSmtp({
  host,
  port,
  user,
  pass,
  from,
  payload,
}: {
  host: string
  port: number
  user: string
  pass: string
  from: string
  payload: ReturnType<typeof buildInviteEmailMessage>
}): Promise<{
  sent: boolean
  provider: string
  reason?: string
  responseStatus?: number
  retryable: boolean
  emailId: string | null
}> {
  let conn: Deno.TcpConn | Deno.TlsConn

  try {
    if (port === 587) {
      // STARTTLS: plain connect first, then upgrade
      conn = await Deno.connect({ hostname: host, port })
      const writer = conn.writable.getWriter()
      const reader = conn.readable.getReader()

      const smtp = new SmtpSession(writer, reader)
      await smtp.readResp() // banner
      await smtp.send('EHLO ' + host)

      // Start TLS
      await smtp.send('STARTTLS')
      await smtp.readResp() // 220 Ready to start TLS

      // Upgrade to TLS
      const tlsConn = await Deno.startTls(conn, { hostname: host })
      conn = tlsConn

      const tlsWriter = tlsConn.writable.getWriter()
      const tlsReader = tlsConn.readable.getReader()
      const tlsSmtp = new SmtpSession(tlsWriter, tlsReader)
      // After STARTTLS + TLS upgrade, server is waiting for our EHLO
      // No extra banner — doSmtpAuthAndSend sends EHLO immediately

      return await doSmtpAuthAndSend(tlsSmtp, host, user, pass, from, payload)
    } else {
      // Assume TLS (port 465)
      conn = await Deno.connectTls({ hostname: host, port })
      const writer = conn.writable.getWriter()
      const reader = conn.readable.getReader()
      const smtp = new SmtpSession(writer, reader)
      await smtp.readResp() // banner

      return await doSmtpAuthAndSend(smtp, host, user, pass, from, payload)
    }
  } finally {
    try {
      if (conn) {
        try { conn.close() } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}

class SmtpSession {
  private _writer: WritableStreamDefaultWriter<Uint8Array>
  private _reader: ReadableStreamDefaultReader<Uint8Array>
  private _buf: string[]
  private _decoder: TextDecoder
  private _encoder: TextEncoder

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>, reader: ReadableStreamDefaultReader<Uint8Array>) {
    this._writer = writer
    this._reader = reader
    this._buf = []
    this._decoder = new TextDecoder()
    this._encoder = new TextEncoder()
  }

  async readResp(): Promise<string> {
    while (true) {
      const { value, done } = await this._reader.read()
      if (done) {
        // If we have accumulated data, return it even on EOF
        if (this._buf.length > 0) {
          const full = this._buf.join('')
          this._buf.length = 0
          return full
        }
        throw new Error('SMTP: connection closed prematurely')
      }
      this._buf.push(this._decoder.decode(value))
      // Try to parse complete SMTP responses from accumulated buffer
      const full = this._buf.join('')
      const lines = full.split('\r\n').filter(Boolean)
      if (lines.length > 0) {
        const last = lines[lines.length - 1]
        // SMTP multi-line response ends with "code SP text"
        if (/^\d{3} /.test(last)) {
          this._buf.length = 0
          return full
        }
      }
    }
  }

  async send(cmd: string): Promise<string> {
    await this._writer.write(this._encoder.encode(cmd + '\r\n'))
    return this.readResp()
  }
}

async function doSmtpAuthAndSend(
  smtp: SmtpSession,
  host: string,
  user: string,
  pass: string,
  from: string,
  payload: ReturnType<typeof buildInviteEmailMessage>,
): Promise<{
  sent: boolean
  provider: string
  reason?: string
  responseStatus?: number
  retryable: boolean
  emailId: string | null
}> {
  // EHLO (again after TLS)
  if (host) {
    await smtp.send('EHLO ' + host)
  }

  // AUTH LOGIN
  const authResp = await smtp.send('AUTH LOGIN')
  if (!authResp.startsWith('334')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_auth_not_supported', responseStatus: 0, retryable: false, emailId: null }
  }

  await smtp.send(btoa(user))
  const passResp = await smtp.send(btoa(pass))
  if (!passResp.startsWith('235') && !passResp.startsWith('334')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_auth_failed', responseStatus: 0, retryable: false, emailId: null }
  }

  // MAIL FROM
  const fromAddr = from.match(/<([^>]+)>/)?.[1] || from
  const mailFromResp = await smtp.send(`MAIL FROM:<${fromAddr}>`)
  if (!mailFromResp.startsWith('250')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_mail_from_failed: ' + mailFromResp.slice(0, 100), responseStatus: 0, retryable: true, emailId: null }
  }

  // RCPT TO
  const rcptResp = await smtp.send(`RCPT TO:<${payload.to[0]}>`)
  if (!rcptResp.startsWith('250')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_rcpt_failed: ' + rcptResp.slice(0, 100), responseStatus: 0, retryable: false, emailId: null }
  }

  // DATA
  const dataResp = await smtp.send('DATA')
  if (!dataResp.startsWith('354')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_data_rejected: ' + dataResp.slice(0, 100), responseStatus: 0, retryable: true, emailId: null }
  }

  // Build email content
  const messageId = `<${crypto.randomUUID()}@nexuscrm.local>`
  const headers = [
    `From: ${from}`,
    `To: ${payload.to[0]}`,
    `Subject: ${payload.subject}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ].join('\r\n')

  const emailContent = `${headers}\r\n\r\n${payload.html}`
  const endResp = await smtp.send(emailContent + '\r\n.')
  if (!endResp.startsWith('250')) {
    return { sent: false, provider: 'smtp', reason: 'smtp_send_failed: ' + endResp.slice(0, 100), responseStatus: 0, retryable: true, emailId: null }
  }

  // QUIT
  try { await smtp.send('QUIT') } catch { /* ignore */ }

  return { sent: true, provider: 'smtp', reason: undefined, responseStatus: 250, retryable: false, emailId: messageId }
}

// ---------------------------------------------------------------------------
// Resend sender (unchanged)
// ---------------------------------------------------------------------------

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
      reason: (data?.message as string | undefined) ?? `resend_${response.status}`,
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

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
      provider: providers[0]?.name ?? 'smtp',
      reason: 'email_provider_not_configured',
      attempts: [],
    }
  }

  const attempts: Array<{
    provider: string
    attempt: number
    sent: boolean
    reason?: string | null
    responseStatus?: number | null
  }> = []

  for (const provider of providers) {
    const payload = buildInviteEmailMessage({
      appBaseUrl,
      from: 'provider' in provider && provider.provider === 'smtp'
        ? provider.from
        : (provider as { from: string }).from,
      inviteeEmail,
      invitedByEmail,
      tenantName,
      role,
      token,
    })

    for (let attempt = 1; attempt <= provider.retries + 1; attempt += 1) {
      let delivery: {
        sent: boolean
        provider: string
        reason?: string
        responseStatus?: number
        retryable: boolean
        emailId: string | null
      }

      if ('provider' in provider && provider.provider === 'smtp') {
        const smtpProvider = provider as {
          name: string
          provider: 'smtp'
          host: string
          port: number
          user: string
          pass: string
          from: string
          retries: number
        }
        delivery = await sendViaSmtp({
          host: smtpProvider.host,
          port: smtpProvider.port,
          user: smtpProvider.user,
          pass: smtpProvider.pass,
          from: smtpProvider.from,
          payload,
        })
      } else {
        const resendProvider = provider as {
          name: string
          provider: 'resend'
          apiKey: string
          from: string
          retries: number
        }
        delivery = await sendViaResend({
          apiKey: resendProvider.apiKey,
          payload,
          providerName: resendProvider.name,
          token,
        })
      }

      attempts.push({
        provider: delivery.provider,
        attempt,
        sent: delivery.sent,
        reason: delivery.reason,
        responseStatus: delivery.responseStatus,
      })

      if (delivery.sent) {
        return {
          sent: true,
          skipped: false,
          provider: delivery.provider,
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
    provider: lastAttempt?.provider ?? providers[0]?.name ?? 'smtp',
    reason: lastAttempt?.reason ?? 'email_delivery_failed',
    responseStatus: lastAttempt?.responseStatus ?? null,
    attempts,
  }
}
