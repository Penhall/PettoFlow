import { json, preflight } from '../_shared/cors.ts'
import { decrypt } from '../_shared/crypto.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { escapeHtml, sendMessage } from '../_shared/telegram.ts'

type ActivityRow = {
  id: number | string
  tenant_id: string | null
  title: string
  scheduled_at: string
}

type MembershipRow = {
  user_id: string
  tenant_id: string
}

type BotConfigRow = {
  telegram_bot_token: string | null
  allowed_telegram_ids: string[] | null
  is_active: boolean | null
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatScheduledAt(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

async function notifyTelegram(config: BotConfigRow | null, activity: ActivityRow) {
  if (!config?.is_active || !config.telegram_bot_token) return 0

  const chatIds = Array.isArray(config.allowed_telegram_ids)
    ? config.allowed_telegram_ids.filter(Boolean)
    : []
  if (chatIds.length === 0) return 0

  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKey) {
    console.log('notification-worker: ENCRYPTION_KEY nao configurada; Telegram ignorado')
    return 0
  }

  let botToken = ''
  try {
    botToken = await decrypt(config.telegram_bot_token, encryptionKey)
  } catch (error) {
    console.log('notification-worker: falha ao descriptografar token do Telegram', error)
    return 0
  }

  const text = [
    '🔔 <b>Lembrete de atividade</b>',
    `<b>${escapeHtml(activity.title)}</b>`,
    `Agendada para ${escapeHtml(formatScheduledAt(activity.scheduled_at))}`,
  ].join('\n')

  for (const chatId of chatIds) {
    await sendMessage(botToken, chatId, text)
  }

  return chatIds.length
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req, 'GET, POST, OPTIONS')
  if (!['GET', 'POST'].includes(req.method)) {
    return json(req, { error: 'Metodo nao permitido.' }, 405)
  }

  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return json(req, { error: 'Unauthorized' }, 401)
  }

  const sb = getServiceRoleClient()
  const now = new Date()
  const windowEnd = addMinutes(now, 15)

  const { data: activities, error: activitiesError } = await sb
    .from('activities')
    .select('id, tenant_id, title, scheduled_at')
    .eq('status', 'pending')
    .is('notified_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', windowEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  if (activitiesError) {
    console.log('notification-worker: erro ao buscar atividades', activitiesError)
    return json(req, { error: activitiesError.message }, 500)
  }

  const uniqueTenantIds = [
    ...new Set(
      (activities ?? [])
        .map((activity) => activity.tenant_id)
        .filter((tenantId): tenantId is string => Boolean(tenantId)),
    ),
  ]
  let allMemberships: MembershipRow[] = []

  if (uniqueTenantIds.length > 0) {
    const { data: memberships, error: membershipsError } = await sb
      .from('memberships')
      .select('user_id, tenant_id')
      .in('tenant_id', uniqueTenantIds)
      .eq('status', 'active')

    if (membershipsError) {
      console.log('notification-worker: erro ao buscar membros ativos', membershipsError)
      return json(req, { error: membershipsError.message }, 500)
    }

    allMemberships = (memberships ?? []) as MembershipRow[]
  }

  let created = 0
  let telegramSent = 0
  const processed: Array<string | number> = []
  const botConfigByTenant = new Map<string, BotConfigRow | null>()

  for (const activity of (activities ?? []) as ActivityRow[]) {
    if (!activity.tenant_id) {
      console.log(`notification-worker: atividade ${activity.id} sem tenant_id; ignorada`)
      continue
    }

    if (!botConfigByTenant.has(activity.tenant_id)) {
      const { data: tenantBotConfig } = await sb
        .from('bot_configs')
        .select('telegram_bot_token, allowed_telegram_ids, is_active')
        .eq('tenant_id', activity.tenant_id)
        .maybeSingle()

      botConfigByTenant.set(activity.tenant_id, tenantBotConfig as BotConfigRow | null)
    }

    const membersForActivity = allMemberships.filter((membership) => membership.tenant_id === activity.tenant_id)
    const rows = membersForActivity.map((membership) => ({
      tenant_id: activity.tenant_id,
      user_id: membership.user_id,
      type: 'activity_reminder',
      title: activity.title,
      body: `Atividade agendada para ${formatScheduledAt(activity.scheduled_at)}.`,
      resource_type: 'activity',
      resource_id: String(activity.id),
    }))

    if (rows.length > 0) {
      const { error: insertError } = await sb
        .from('notifications')
        .upsert(rows, { onConflict: 'user_id,resource_type,resource_id,type', ignoreDuplicates: true })
      if (insertError) {
        console.log(`notification-worker: erro ao criar notificacoes da atividade ${activity.id}`, insertError)
        continue
      }
      created += rows.length
    }

    telegramSent += await notifyTelegram(botConfigByTenant.get(activity.tenant_id) ?? null, activity)

    const { error: updateError } = await sb
      .from('activities')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', activity.id)
      .is('notified_at', null)

    if (updateError) {
      console.log(`notification-worker: erro ao marcar atividade ${activity.id} como notificada`, updateError)
      continue
    }

    processed.push(activity.id)
  }

  console.log('notification-worker: ciclo concluido', {
    found: activities?.length ?? 0,
    processed: processed.length,
    created,
    telegramSent,
  })

  return json(req, {
    ok: true,
    found: activities?.length ?? 0,
    processed: processed.length,
    created,
    telegramSent,
  })
})
