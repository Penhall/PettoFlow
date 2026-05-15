// supabase/functions/telegram-webhook/actions/activities.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { escapeHtml } from '../../_shared/telegram.ts'

function makeTiptapBody(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  }
}

const TYPE_LABELS: Record<string, string> = {
  note: '📝 Nota',
  meeting: '🤝 Reunião',
  call: '📞 Ligação',
}

export async function logActivity(
  sb: SupabaseClient,
  tenantId: string,
  type: string,
  text: string
): Promise<string> {
  const title = text || `${TYPE_LABELS[type] ?? type} via Telegram`
  const { error } = await sb.from('activities').insert({
    tenant_id: tenantId,
    title,
    type,
    body: makeTiptapBody(text),
    status: 'completed',
    scheduled_at: new Date().toISOString(),
  })
  if (error) throw error
  return `✅ ${TYPE_LABELS[type] ?? type} registrada: <b>${escapeHtml(title)}</b>`
}

export async function listActivities(sb: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await sb
    .from('activities')
    .select('title, type, scheduled_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma atividade recente.'

  const lines = ['📋 <b>Atividades recentes:</b>']
  for (const a of data) {
    const label = TYPE_LABELS[a.type] ?? a.type
    const date = a.scheduled_at
      ? new Date(a.scheduled_at).toLocaleDateString('pt-BR')
      : '—'
    lines.push(`• ${label}: ${escapeHtml(a.title)} <i>(${date})</i>`)
  }
  return lines.join('\n')
}
