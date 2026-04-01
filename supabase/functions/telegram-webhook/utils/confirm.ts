// supabase/functions/telegram-webhook/utils/confirm.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function requestConfirmation(
  sb: SupabaseClient,
  chatId: string,
  actionType: string,
  actionPayload: Record<string, unknown>,
  confirmMessage: string
): Promise<string> {
  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('chat_id', chatId)
    .eq('action_type', actionType)

  await sb.from('bot_pending_confirmations').insert({
    chat_id: chatId,
    action_type: actionType,
    action_payload: actionPayload,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return `⚠️ ${confirmMessage}\n\nResponda <b>SIM</b> para confirmar ou <b>NÃO</b> para cancelar.`
}

export async function getPendingConfirmation(
  sb: SupabaseClient,
  chatId: string
): Promise<{ action_type: string; action_payload: Record<string, unknown> } | null> {
  const { data } = await sb
    .from('bot_pending_confirmations')
    .select('action_type, action_payload, expires_at')
    .eq('chat_id', chatId)
    .not('action_type', 'eq', 'task_list_context')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    await sb.from('bot_pending_confirmations').delete().eq('chat_id', chatId)
    return null
  }
  return data
}

export async function clearPendingConfirmation(
  sb: SupabaseClient,
  chatId: string
): Promise<void> {
  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('chat_id', chatId)
    .not('action_type', 'eq', 'task_list_context')
}
