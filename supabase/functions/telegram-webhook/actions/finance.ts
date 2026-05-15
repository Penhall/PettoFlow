// supabase/functions/telegram-webhook/actions/finance.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { escapeHtml } from '../../_shared/telegram.ts'

function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function getPrincipalAccountId(sb: SupabaseClient, tenantId: string): Promise<number | null> {
  const { data } = await sb
    .from('accounts')
    .select('id, category')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!data || data.length === 0) return null

  const principal = data.find((a: { id: number; category: string }) => a.category === 'principal')
  return principal?.id ?? data[0].id
}

export async function recordTransaction(
  sb: SupabaseClient,
  tenantId: string,
  direction: 'in' | 'out',
  description: string,
  amount: number
): Promise<string> {
  const accountId = await getPrincipalAccountId(sb, tenantId)
  if (!accountId) return '❌ Nenhuma conta encontrada. Crie uma conta no NexusCRM antes de usar este comando.'

  const amountCents = Math.round(Math.abs(amount) * 100)
  const signedAmount = direction === 'out' ? -amountCents : amountCents
  const { error } = await sb.from('transactions').insert({
    tenant_id: tenantId,
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
  return `${emoji} ${label} registrada: <b>${escapeHtml(description)}</b> — ${formatCentsBRL(amountCents)}`
}

export async function getBalance(sb: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await sb
    .from('accounts')
    .select('id, name, opening_balance')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error) throw error
  if (!data || data.length === 0) return '❌ Nenhuma conta encontrada.'

  const lines = ['💰 <b>Saldos:</b>']
  for (const account of data) {
    const { data: txs } = await sb
      .from('transactions')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('account_id', account.id)

    const total = (txs ?? []).reduce((sum: number, t: { amount: number }) => sum + (t.amount ?? 0), 0)
    const balance = (account.opening_balance ?? 0) + total
    lines.push(`• ${escapeHtml(account.name)}: ${formatCentsBRL(balance)}`)
  }
  return lines.join('\n')
}

export async function listTransactions(sb: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await sb
    .from('transactions')
    .select('amount, date, notes')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(5)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma transação encontrada.'

  const lines = ['📋 <b>Últimas transações:</b>']
  for (const t of data) {
    const emoji = (t.amount ?? 0) < 0 ? '💸' : '💰'
    const value = formatCentsBRL(Math.abs(t.amount ?? 0))
    const date = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—'
    lines.push(`${emoji} ${value} — ${escapeHtml(t.notes ?? '(sem descrição)')} <i>(${date})</i>`)
  }
  return lines.join('\n')
}
