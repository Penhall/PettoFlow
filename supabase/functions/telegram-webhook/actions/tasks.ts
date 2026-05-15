// supabase/functions/telegram-webhook/actions/tasks.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { escapeHtml } from '../../_shared/telegram.ts'

async function getBoardStatuses(sb: SupabaseClient, tenantId: string): Promise<{ initial: string; terminal: string }> {
  const { data } = await sb
    .from('kanban_columns')
    .select('name')
    .eq('tenant_id', tenantId)
    .order('order_index', { ascending: true })

  if (!data || data.length === 0) {
    return { initial: 'A Fazer', terminal: 'Concluído' }
  }

  return {
    initial: data[0].name,
    terminal: data[data.length - 1].name,
  }
}

export async function createTask(
  sb: SupabaseClient,
  tenantId: string,
  title: string
): Promise<string> {
  const { initial } = await getBoardStatuses(sb, tenantId)
  const { error } = await sb
    .from('tasks')
    .insert({ tenant_id: tenantId, title, status: initial, priority: 'Média' })
  if (error) throw error
  return `✅ Tarefa criada: <b>${escapeHtml(title)}</b>`
}

export async function listTasks(
  sb: SupabaseClient,
  tenantId: string,
  chatId: string
): Promise<string> {
  const { terminal } = await getBoardStatuses(sb, tenantId)
  const { data, error } = await sb
    .from('tasks')
    .select('id, title, status, priority')
    .eq('tenant_id', tenantId)
    .is('archived_at', null)
    .not('status', 'eq', terminal)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma tarefa pendente.'

  const grouped: Record<string, typeof data> = {}
  for (const task of data) {
    if (!grouped[task.status]) grouped[task.status] = []
    grouped[task.status].push(task)
  }

  let counter = 1
  const listContext: Array<{ num: number; id: string | number; title: string }> = []
  const lines: string[] = ['📋 <b>Tarefas:</b>']

  for (const [status, tasks] of Object.entries(grouped)) {
    lines.push(`\n<b>${escapeHtml(status)}</b>`)
    for (const task of tasks.slice(0, 5)) {
      lines.push(`  ${counter}. ${escapeHtml(task.title)} [${escapeHtml(task.priority)}]`)
      listContext.push({ num: counter, id: task.id, title: task.title })
      counter++
    }
  }

  lines.push('\nUse /ok [número] para concluir.')

  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
  await sb.from('bot_pending_confirmations').insert({
    tenant_id: tenantId,
    chat_id: chatId,
    action_type: 'task_list_context',
    action_payload: { items: listContext },
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })

  return lines.join('\n')
}

export async function completeTask(
  sb: SupabaseClient,
  tenantId: string,
  chatId: string,
  num: number
): Promise<string> {
  const { terminal } = await getBoardStatuses(sb, tenantId)
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('tenant_id', tenantId)
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string | number; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado na lista. Use /tarefas para atualizar.`

  const { error } = await sb
    .from('tasks')
    .update({ status: terminal, completed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', item.id)

  if (error) throw error
  return `✅ Tarefa concluída: <b>${escapeHtml(item.title)}</b>`
}

export async function setPriority(
  sb: SupabaseClient,
  tenantId: string,
  chatId: string,
  num: number,
  priority: string
): Promise<string> {
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('tenant_id', tenantId)
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string | number; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado. Use /tarefas para atualizar.`

  const { error } = await sb
    .from('tasks')
    .update({ priority })
    .eq('tenant_id', tenantId)
    .eq('id', item.id)
  if (error) throw error
  return `✅ Prioridade de <b>${escapeHtml(item.title)}</b> alterada para <b>${escapeHtml(priority)}</b>`
}
