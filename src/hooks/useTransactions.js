// src/hooks/useTransactions.js
// filters: { accountId?, categoryId?, dateFrom?, dateTo?, needsReview?, relatedTo?: {type, id} }
// rules: FinRule[] pré-ordenada (recebida de FinanceView via useFinRules)
// — o hook reordena internamente ao chamar runRulesEngine para garantir consistência.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { runRulesEngine } from '../lib/rulesEngine'

export function useTransactions(filters = {}, rules = []) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // useRef para evitar stale closure em addTransaction/applyRules
  const rulesRef = useRef(rules)
  useEffect(() => { rulesRef.current = rules }, [rules])

  // JSON.stringify como dep evita re-fetch desnecessário quando objeto é recriado com mesmo conteúdo
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    let query = supabase.from('transactions').select('*')
    if (filters?.accountId)              query = query.eq('account_id', filters.accountId)
    if (filters?.categoryId)             query = query.eq('category_id', filters.categoryId)
    if (filters?.dateFrom)               query = query.gte('date', filters.dateFrom)
    if (filters?.dateTo)                 query = query.lte('date', filters.dateTo)
    if (filters?.needsReview !== undefined) query = query.eq('needs_review', filters.needsReview)
    // PostgREST operador cs (@>) para array JSONB com partial object matching.
    // PostgreSQL @> verifica se o array do lado esquerdo contém um elemento que seja
    // superset do elemento do lado direito — ou seja, {type,id,label} @> {type,id} = true.
    // ATENÇÃO: o `id` deve ter o mesmo tipo JavaScript (number) do que está armazenado no JSONB.
    // IDs no related_to vêm de objetos do banco (bigint → number em JS), então passar Number(id).
    if (filters?.relatedTo) {
      query = query.contains('related_to', [{ type: filters.relatedTo.type, id: Number(filters.relatedTo.id) }])
    }

    query
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching transactions:', error)
        else setTransactions(data || [])
        setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const _getSortedRules = () =>
    [...(rulesRef.current || [])].sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id - b.id
    )

  const addTransaction = async (form) => {
    if (!supabase) return null
    const { enriched, ruleMatched } = runRulesEngine(form, _getSortedRules())
    // payee_name é campo efêmero usado pelo rules engine — não persiste no DB
    const { payee_name, ...dbPayload } = enriched
    const payload = { ...dbPayload, needs_review: !ruleMatched }
    const { data, error } = await supabase.from('transactions').insert([payload]).select()
    if (error) { console.error('Error adding transaction:', error); return null }
    setTransactions(prev => [data[0], ...prev])
    return data[0]
  }

  const updateTransaction = async (id, updates) => {
    if (!supabase) return null
    const { payee_name, ...dbUpdates } = updates
    const { data, error } = await supabase.from('transactions').update(dbUpdates).eq('id', id).select()
    if (error) { console.error('Error updating transaction:', error); return null }
    setTransactions(prev => prev.map(t => t.id === id ? data[0] : t))
    return data[0]
  }

  const deleteTransaction = async (id) => {
    if (!supabase) return false
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { console.error('Error deleting transaction:', error); return false }
    setTransactions(prev => prev.filter(t => t.id !== id))
    return true
  }

  // Re-processa APENAS as transações atualmente em memória com needs_review=true.
  // Erros são logados por transação, nunca propagados.
  const applyRules = async () => {
    const sortedRules = _getSortedRules()
    const pending = transactions.filter(t => t.needs_review)
    for (const tx of pending) {
      const { enriched, ruleMatched } = runRulesEngine(tx, sortedRules)
      if (ruleMatched) {
        await updateTransaction(tx.id, { ...enriched, needs_review: false })
      }
    }
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, applyRules }
}
