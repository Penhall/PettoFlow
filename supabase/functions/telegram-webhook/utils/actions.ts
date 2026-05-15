// supabase/functions/telegram-webhook/utils/actions.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { createTask, listTasks } from '../actions/tasks.ts'
import { logActivity, listActivities } from '../actions/activities.ts'
import { recordTransaction, getBalance, listTransactions } from '../actions/finance.ts'

export interface ActionItem {
  action: string
  params: Record<string, unknown>
}

export async function executeActions(
  sb: SupabaseClient,
  tenantId: string,
  chatId: string,
  actions: ActionItem[]
): Promise<string> {
  const results: string[] = []

  for (const { action, params } of actions) {
    switch (action) {
      case 'finance.record':
        results.push(await recordTransaction(
          sb,
          tenantId,
          params.direction as 'in' | 'out',
          params.description as string,
          params.amount as number
        ))
        break
      case 'finance.balance':
        results.push(await getBalance(sb, tenantId))
        break
      case 'finance.list':
        results.push(await listTransactions(sb, tenantId))
        break
      case 'tasks.create':
        results.push(await createTask(sb, tenantId, params.title as string))
        break
      case 'tasks.list':
        results.push(await listTasks(sb, tenantId, chatId))
        break
      case 'activities.log':
        results.push(await logActivity(
          sb,
          tenantId,
          params.type as string,
          params.text as string
        ))
        break
      case 'activities.list':
        results.push(await listActivities(sb, tenantId))
        break
      default:
        console.warn('[actions] unknown action:', action)
    }
  }

  return results.filter(Boolean).join('\n\n')
}
