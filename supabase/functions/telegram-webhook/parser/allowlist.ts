// supabase/functions/telegram-webhook/parser/allowlist.ts

export const ALLOWED_ACTIONS = new Set([
  'tasks.create',
  'tasks.list',
  'tasks.complete',
  'tasks.setPriority',
  'activities.log',
  'activities.list',
  'finance.record',
  'finance.balance',
  'finance.list',
  'bot.start',
  'bot.help',
  'bot.status',
])

export function isAllowed(action: string): boolean {
  return ALLOWED_ACTIONS.has(action)
}
