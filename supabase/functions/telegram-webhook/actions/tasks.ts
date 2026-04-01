// supabase/functions/telegram-webhook/actions/tasks.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function createTask(
  sb: SupabaseClient,
  title: string
): Promise<string> {
  const { error } = await sb
    .from('tasks')
    .insert({ title, status: 'A Fazer', priority: 'Média' })
  if (error) throw error
  return `✅ Tarefa criada: <b>${title}</b>`
}

export async function listTasks(
  sb: SupabaseClient,
  chatId: string
): Promise<string> {
  const { data, error } = await sb
    .from('tasks')
    .select('id, title, status, priority')
    .is('archived_at', null)
    .not('status', 'eq', 'Concluído')
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
  const listContext: Array<{ num: number; id: string; title: string }> = []
  const lines: string[] = ['📋 <b>Tarefas:</b>']

  for (const [status, tasks] of Object.entries(grouped)) {
    lines.push(`\n<b>${status}</b>`)
    for (const task of tasks.slice(0, 5)) {
      lines.push(`  ${counter}. ${task.title} [${task.priority}]`)
      listContext.push({ num: counter, id: task.id, title: task.title })
      counter++
    }
  }

  lines.push('\nUse /ok [número] para concluir.')

  // Salva contexto de numeração (expira em 30 min)
  await sb.from('bot_pending_confirmations').delete().eq('chat_id', chatId).eq('action_type', 'task_list_context')
  await sb.from('bot_pending_confirmations').insert({
    chat_id: chatId,
    action_type: 'task_list_context',
    action_payload: { items: listContext },
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })

  return lines.join('\n')
}

export async function completeTask(
  sb: SupabaseClient,
  chatId: string,
  num: number
): Promise<string> {
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado na lista. Use /tarefas para atualizar.`

  const { error } = await sb
    .from('tasks')
    .update({ status: 'Concluído', completed_at: new Date().toISOString() })
    .eq('id', item.id)

  if (error) throw error
  return `✅ Tarefa concluída: <b>${item.title}</b>`
}

export async function setPriority(
  sb: SupabaseClient,
  chatId: string,
  num: number,
  priority: string
): Promise<string> {
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado. Use /tarefas para atualizar.`

  const { error } = await sb.from('tasks').update({ priority }).eq('id', item.id)
  if (error) throw error
  return `✅ Prioridade de <b>${item.title}</b> alterada para <b>${priority}</b>`
}
