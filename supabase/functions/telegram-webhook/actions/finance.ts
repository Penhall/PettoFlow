// supabase/functions/telegram-webhook/actions/finance.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

async function getPrincipalAccountId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from('accounts')
    .select('id, category')
    .eq('is_active', true)

  if (!data || data.length === 0) return null

  const principal = data.find((a: { id: string; category: string }) => a.category === 'principal')
  return principal?.id ?? data[0].id
}

export async function recordTransaction(
  sb: SupabaseClient,
  direction: 'in' | 'out',
  description: string,
  amount: number
): Promise<string> {
  const accountId = await getPrincipalAccountId(sb)
  if (!accountId) return '❌ Nenhuma conta encontrada. Crie uma conta no PettoFlow antes de usar este comando.'

  const signedAmount = direction === 'out' ? -Math.abs(amount) : Math.abs(amount)
  const { error } = await sb.from('transactions').insert({
    account_id: accountId,
    amount: signedAmount,
    date: new Date().toISOString().split('T')[0],
    notes: description,
    cleared: false,
    needs_review: true,
  })

  if (error) throw error
  const emoji = direction === 'out' ? '💸' : '💰'
  const label = direction === 'out' ? 'Saída' : 'Entrada'
  return `${emoji} ${label} registrada: <b>${description}</b> — R$ ${amount.toFixed(2).replace('.', ',')}`
}

export async function getBalance(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from('accounts')
    .select('name, opening_balance')
    .eq('is_active', true)

  if (error) throw error
  if (!data || data.length === 0) return '❌ Nenhuma conta encontrada.'

  const lines = ['💰 <b>Saldos:</b>']
  for (const account of data) {
    const { data: txs } = await sb
      .from('transactions')
      .select('amount')
      .eq('account_id', account.id)

    const total = (txs ?? []).reduce((sum: number, t: { amount: number }) => sum + (t.amount ?? 0), 0)
    const balance = (account.opening_balance ?? 0) + total
    lines.push(`• ${account.name}: R$ ${balance.toFixed(2).replace('.', ',')}`)
  }
  return lines.join('\n')
}

export async function listTransactions(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from('transactions')
    .select('amount, date, notes')
    .order('date', { ascending: false })
    .limit(5)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma transação encontrada.'

  const lines = ['📋 <b>Últimas transações:</b>']
  for (const t of data) {
    const emoji = (t.amount ?? 0) < 0 ? '💸' : '💰'
    const value = Math.abs(t.amount ?? 0).toFixed(2).replace('.', ',')
    const date = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—'
    lines.push(`${emoji} R$ ${value} — ${t.notes ?? '(sem descrição)'} <i>(${date})</i>`)
  }
  return lines.join('\n')
}
