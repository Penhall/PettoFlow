# Módulo Financeiro — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um módulo financeiro nativo no PettoFlow com contas, transações, payees, categorias e rules engine, integrado ao CRM existente.

**Architecture:** Foundation-first — SQL + utils puros + hooks primeiro (sem UI), depois componentes Finance isolados, por último wiring no App.jsx e integração nas views existentes. Rules engine é JavaScript puro; amounts em centavos (integers); Supabase JS v2 seguindo o mesmo padrão de `useActivities.js`.

**Tech Stack:** React 18, Vite (JSX), Supabase JS v2, Framer Motion, Lucide React (`Wallet`), CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-03-17-financial-module-design.md`

---

## File Structure

**Criar:**
- `supabase_financial_module.sql` — DDL 6 tabelas + indexes + RLS + seed
- `src/lib/finUtils.js` — `centsToReal()`, `realToCents()`
- `src/lib/rulesEngine.js` — engine de regras puras (sem hooks)
- `src/hooks/useAccounts.js`
- `src/hooks/usePayees.js`
- `src/hooks/useFinCategories.js`
- `src/hooks/useFinRules.js`
- `src/hooks/useTransactions.js`
- `src/components/Finance/AccountCard.jsx`
- `src/components/Finance/AccountForm.jsx`
- `src/components/Finance/TransactionList.jsx`
- `src/components/Finance/TransactionForm.jsx`
- `src/components/Finance/RuleBuilder.jsx`
- `src/components/Finance/FinanceView.jsx`

**Modificar:**
- `src/components/Sidebar.jsx` — adicionar item Finanças com ícone `Wallet`
- `src/App.jsx` — importar FinanceView, adicionar `case 'financas'`
- `src/components/Clients/ClientProfileModal.jsx` — seção Transações Vinculadas
- `src/components/Tasks/TaskModal.jsx` — botão "Vincular Transação"
- `src/index.css` — classes CSS do módulo Finance

---

## Chunk 1: Data Layer

### Task 1: SQL Migration (MANUAL — executar no Supabase)

**Files:**
- Create: `supabase_financial_module.sql`

- [ ] **Step 1: Criar o arquivo SQL na raiz do projeto**

```sql
-- =============================================================================
-- PettoFlow — Módulo Financeiro
-- Executar no Supabase SQL Editor
-- =============================================================================

-- 1. TABELAS

CREATE TABLE public.accounts (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('checking','savings','credit','cash')),
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payees (
  id                BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name              TEXT NOT NULL,
  learn_categories  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.category_groups (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  is_income  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.fin_categories (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  group_id   BIGINT REFERENCES public.category_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden     BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.transactions (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  account_id   BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  date         DATE NOT NULL,
  payee_id     BIGINT REFERENCES public.payees(id) ON DELETE SET NULL,
  category_id  BIGINT REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  notes        TEXT,
  related_to   JSONB NOT NULL DEFAULT '[]',
  cleared      BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fin_rules (
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  priority    INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ÍNDICES

CREATE INDEX idx_transactions_account_date ON public.transactions (account_id, date DESC);
CREATE INDEX idx_transactions_category     ON public.transactions (category_id);
CREATE INDEX idx_transactions_needs_review ON public.transactions (needs_review) WHERE needs_review = true;

-- 3. RLS

ALTER TABLE public.accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_rules       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public accounts"        ON public.accounts        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public payees"          ON public.payees          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public category_groups" ON public.category_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public fin_categories"  ON public.fin_categories  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public transactions"    ON public.transactions    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public fin_rules"       ON public.fin_rules       FOR ALL USING (true) WITH CHECK (true);

-- 4. SEED DATA

INSERT INTO public.category_groups (name, is_income, sort_order) VALUES
  ('Moradia',     false, 1),
  ('Alimentação', false, 2),
  ('Transporte',  false, 3),
  ('Saúde',       false, 4),
  ('Lazer',       false, 5),  -- Adicionado além dos 5 grupos base da spec
  ('Receitas',    true,  6);

INSERT INTO public.fin_categories (name, group_id, sort_order)
SELECT 'Aluguel',           id, 1 FROM public.category_groups WHERE name = 'Moradia'    UNION ALL
SELECT 'Condomínio',        id, 2 FROM public.category_groups WHERE name = 'Moradia'    UNION ALL
SELECT 'Supermercado',      id, 1 FROM public.category_groups WHERE name = 'Alimentação' UNION ALL
SELECT 'Restaurante',       id, 2 FROM public.category_groups WHERE name = 'Alimentação' UNION ALL
SELECT 'Combustível',       id, 1 FROM public.category_groups WHERE name = 'Transporte'  UNION ALL
SELECT 'Transporte Público',id, 2 FROM public.category_groups WHERE name = 'Transporte'  UNION ALL
SELECT 'Consulta',          id, 1 FROM public.category_groups WHERE name = 'Saúde'       UNION ALL
SELECT 'Farmácia',          id, 2 FROM public.category_groups WHERE name = 'Saúde'       UNION ALL
SELECT 'Salário',           id, 1 FROM public.category_groups WHERE name = 'Receitas'    UNION ALL
SELECT 'Serviços',          id, 2 FROM public.category_groups WHERE name = 'Receitas';
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

Cole o conteúdo acima no SQL Editor do Supabase → clique em Run.
Resultado esperado: "Success. No rows returned."

- [ ] **Step 3: Commit do arquivo SQL**

```bash
git add supabase_financial_module.sql
git commit -m "feat: SQL migration do módulo financeiro (6 tabelas + seed)"
```

---

### Task 2: finUtils.js

**Files:**
- Create: `src/lib/finUtils.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/lib/finUtils.js

// Converte centavos (integer) para string formatada em BRL
// Ex: centsToReal(150000) → "R$ 1.500,00"
// Ex: centsToReal(-5050) → "-R$ 50,50"
export function centsToReal(cents) {
  if (cents == null || isNaN(cents)) return 'R$ 0,00'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Converte string de valor real para centavos (integer)
// Suporta: "1.500,00", "1500.00", "1500", "-150,00"
// Retorna 0 para entradas inválidas (null, undefined, NaN)
export function realToCents(str) {
  if (str == null || str === '') return 0
  const cleaned = String(str)
    .replace(/[R$\s]/g, '')   // remove símbolo e espaços
    .replace(/\./g, '')        // remove separador de milhar (ponto BR)
    .replace(',', '.')         // converte vírgula decimal em ponto
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: Build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/finUtils.js
git commit -m "feat: utilitários financeiros centsToReal/realToCents"
```

---

### Task 3: rulesEngine.js

**Files:**
- Create: `src/lib/rulesEngine.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/lib/rulesEngine.js
// Motor de regras puro — sem hooks, sem efeitos colaterais, nunca lança exceção.
// O caller é responsável por ordenar `rules` por (priority ASC, id ASC) antes de passar.
// Aplica TODAS as regras cujas condições batem (apply-all, não first-match-wins).

export function evaluateCondition(condition, transaction) {
  try {
    const { field, op, value } = condition
    const fieldValue = transaction[field]
    switch (op) {
      case 'contains':
        return String(fieldValue ?? '').toLowerCase().includes(String(value).toLowerCase())
      case 'not_contains':
        return !String(fieldValue ?? '').toLowerCase().includes(String(value).toLowerCase())
      case 'is':
        return String(fieldValue) === String(value)
      case 'is_not':
        return String(fieldValue) !== String(value)
      case 'greater_than':
        return Number(fieldValue) > Number(value)
      case 'less_than':
        return Number(fieldValue) < Number(value)
      case 'starts_with':
        return String(fieldValue ?? '').toLowerCase().startsWith(String(value).toLowerCase())
      case 'matches_regexp':
        return new RegExp(value).test(String(fieldValue ?? ''))
      default:
        return false
    }
  } catch {
    return false
  }
}

// Retorna true somente se TODAS as condições do array forem satisfeitas.
// Array vazio retorna false (regra sem condições não bate).
export function allConditionsMatch(conditions, transaction) {
  if (!conditions || conditions.length === 0) return false
  return conditions.every(c => evaluateCondition(c, transaction))
}

// Aplica as ações em cópia da transação; retorna cópia modificada.
export function applyActions(actions, transaction) {
  const result = { ...transaction }
  for (const action of (actions || [])) {
    switch (action.type) {
      case 'set_category': result.category_id = action.value;          break
      case 'rename_payee': result.payee_name  = action.value;          break
      case 'set_notes':    result.notes       = action.value;          break
      case 'set_cleared':  result.cleared     = Boolean(action.value); break
      case 'flag_review':  result.needs_review = Boolean(action.value); break
    }
  }
  return result
}

// Ponto de entrada principal.
// rules deve estar pré-ordenada pelo caller (priority ASC, id ASC).
// Itera sobre todas as regras ativas; aplica as que batem.
export function runRulesEngine(transaction, rules) {
  const activeRules = (rules || []).filter(r => r.is_active)
  let enriched = { ...transaction }
  let ruleMatched = false

  for (const rule of activeRules) {
    if (allConditionsMatch(rule.conditions, enriched)) {
      enriched = applyActions(rule.actions, enriched)
      ruleMatched = true
    }
  }

  return { enriched, ruleMatched }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: Build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rulesEngine.js
git commit -m "feat: rules engine puro para o módulo financeiro"
```

---

### Task 4: useAccounts.js

**Files:**
- Create: `src/hooks/useAccounts.js`

- [ ] **Step 1: Criar o arquivo**

Padrão: idêntico ao de `useActivities.js` — `useState` + `useEffect` com cancellation flag.

```js
// src/hooks/useAccounts.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('accounts')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching accounts:', error)
        else setAccounts(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const addAccount = async (account) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('accounts').insert([account]).select()
    if (error) { console.error('Error adding account:', error); return null }
    setAccounts(prev => [...prev, data[0]])
    return data[0]
  }

  const updateAccount = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating account:', error); return null }
    setAccounts(prev => prev.map(a => a.id === id ? data[0] : a))
    return data[0]
  }

  // Desativa a conta sem excluir (preserva histórico de transações)
  const closeAccount = async (id) => {
    if (!supabase) return
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    if (error) { console.error('Error closing account:', error); return }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: false } : a))
  }

  return { accounts, loading, addAccount, updateAccount, closeAccount }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAccounts.js
git commit -m "feat: hook useAccounts"
```

---

### Task 5: usePayees.js

**Files:**
- Create: `src/hooks/usePayees.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/usePayees.js
// Nota: deletePayee não existe — payee_id usa ON DELETE SET NULL; deletar quebraria histórico.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function usePayees() {
  const [payees, setPayees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('payees')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching payees:', error)
        else setPayees(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Cria payee e retorna o objeto criado imediatamente.
  // TransactionForm usa o ID retornado para pré-selecionar o novo payee antes de salvar.
  const addPayee = async (name) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('payees').insert([{ name }]).select()
    if (error) { console.error('Error adding payee:', error); return null }
    setPayees(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    return data[0]
  }

  const updatePayee = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('payees').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating payee:', error); return null }
    setPayees(prev => prev.map(p => p.id === id ? data[0] : p))
    return data[0]
  }

  return { payees, loading, addPayee, updatePayee }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePayees.js
git commit -m "feat: hook usePayees"
```

---

### Task 6: useFinCategories.js

**Files:**
- Create: `src/hooks/useFinCategories.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useFinCategories.js
// Carrega grupos e categorias em paralelo com Promise.all.
// is_income fica somente no grupo (category_groups.is_income); categorias herdam via JOIN no consumer.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useFinCategories() {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('category_groups').select('*').order('sort_order'),
      supabase.from('fin_categories').select('*').order('sort_order'),
    ]).then(([groupsRes, catsRes]) => {
      if (cancelled) return
      if (groupsRes.error) console.error('Error fetching category_groups:', groupsRes.error)
      else setGroups(groupsRes.data || [])
      if (catsRes.error) console.error('Error fetching fin_categories:', catsRes.error)
      else setCategories(catsRes.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const addGroup = async (group) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('category_groups').insert([group]).select()
    if (error) { console.error('Error adding category_group:', error); return null }
    setGroups(prev => [...prev, data[0]])
    return data[0]
  }

  const addCategory = async (category) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_categories').insert([category]).select()
    if (error) { console.error('Error adding fin_category:', error); return null }
    setCategories(prev => [...prev, data[0]])
    return data[0]
  }

  const updateCategory = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_categories').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating fin_category:', error); return null }
    setCategories(prev => prev.map(c => c.id === id ? data[0] : c))
    return data[0]
  }

  return { groups, categories, loading, addGroup, addCategory, updateCategory }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFinCategories.js
git commit -m "feat: hook useFinCategories"
```

---

### Task 7: useFinRules.js

**Files:**
- Create: `src/hooks/useFinRules.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useFinRules.js
// Prioridade é campo numérico — sem reorderRules nem drag-and-drop.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useFinRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('fin_rules')
      .select('*')
      .order('priority', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error fetching fin_rules:', error)
        else setRules(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const addRule = async (rule) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_rules').insert([rule]).select()
    if (error) { console.error('Error adding fin_rule:', error); return null }
    setRules(prev => [...prev, data[0]])
    return data[0]
  }

  const updateRule = async (id, updates) => {
    if (!supabase) return null
    const { data, error } = await supabase.from('fin_rules').update(updates).eq('id', id).select()
    if (error) { console.error('Error updating fin_rule:', error); return null }
    setRules(prev => prev.map(r => r.id === id ? data[0] : r))
    return data[0]
  }

  const deleteRule = async (id) => {
    if (!supabase) return false
    const { error } = await supabase.from('fin_rules').delete().eq('id', id)
    if (error) { console.error('Error deleting fin_rule:', error); return false }
    setRules(prev => prev.filter(r => r.id !== id))
    return true
  }

  return { rules, loading, addRule, updateRule, deleteRule }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFinRules.js
git commit -m "feat: hook useFinRules"
```

---

### Task 8: useTransactions.js

**Files:**
- Create: `src/hooks/useTransactions.js`

- [ ] **Step 1: Criar o arquivo**

```js
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
```

- [ ] **Step 2: Verificar build completo da camada de dados**

```bash
npm run build
```

Esperado: Build sem erros. Todos os hooks importam apenas `supabaseClient` e `rulesEngine` — sem dependências circulares.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTransactions.js
git commit -m "feat: hook useTransactions com rules engine integrado"
```

---

## Chunk 2: UI Components

> **Pré-requisito:** Tasks 1–8 (SQL migration + todos os hooks + finUtils + rulesEngine) devem estar commitadas e com `npm run build` passando antes de iniciar este chunk.

### Task 9: AccountCard.jsx e AccountForm.jsx

**Files:**
- Create: `src/components/Finance/AccountCard.jsx`
- Create: `src/components/Finance/AccountForm.jsx`

- [ ] **Step 1: Criar AccountCard.jsx**

```jsx
// src/components/Finance/AccountCard.jsx
import { Wallet, CreditCard, PiggyBank, Banknote } from 'lucide-react'
import { centsToReal } from '../../lib/finUtils'

const TYPE_ICONS = { checking: Banknote, savings: PiggyBank, credit: CreditCard, cash: Wallet }
const TYPE_LABELS = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit: 'Cartão de Crédito',
  cash: 'Dinheiro',
}

const AccountCard = ({ account, balance, onClick }) => {
  const Icon = TYPE_ICONS[account.type] || Wallet
  const isNegative = balance < 0
  return (
    <div className={`account-card ${isNegative ? 'negative' : ''}`} onClick={onClick}>
      <div className="account-card-header">
        <Icon size={20} className="account-icon" />
        <span className="account-type-badge">{TYPE_LABELS[account.type] || account.type}</span>
      </div>
      <div className="account-name">{account.name}</div>
      <div className={`account-balance ${isNegative ? 'negative' : 'positive'}`}>
        {centsToReal(balance)}
      </div>
    </div>
  )
}

export default AccountCard
```

- [ ] **Step 2: Criar AccountForm.jsx**

```jsx
// src/components/Finance/AccountForm.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { realToCents } from '../../lib/finUtils'

const AccountForm = ({ account, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', type: 'checking' })
  const [balanceInput, setBalanceInput] = useState('0,00')

  useEffect(() => {
    if (account) {
      setForm({ name: account.name, type: account.type })
      // Usar toFixed(2) garante sempre dois casas decimais (ex: 150000 → "1500,00")
      setBalanceInput((account.opening_balance / 100).toFixed(2).replace('.', ','))
    }
  }, [account])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, opening_balance: realToCents(balanceInput) })
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{account ? 'Editar Conta' : 'Nova Conta'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome da Conta *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Conta Bradesco"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="checking">Conta Corrente</option>
              <option value="savings">Poupança</option>
              <option value="credit">Cartão de Crédito</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
          <div className="form-group">
            <label>Saldo Inicial (R$)</label>
            <input
              type="text"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">{account ? 'Salvar' : 'Criar Conta'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default AccountForm
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Finance/AccountCard.jsx src/components/Finance/AccountForm.jsx
git commit -m "feat: AccountCard e AccountForm"
```

---

### Task 10: TransactionList.jsx

**Files:**
- Create: `src/components/Finance/TransactionList.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Finance/TransactionList.jsx
import { AlertTriangle, Edit2, Trash2, CheckCircle } from 'lucide-react'
import { centsToReal } from '../../lib/finUtils'

const TransactionList = ({
  transactions,
  accounts,
  payees,
  categories,
  onEdit,
  onDelete,
  onApplyRules,
  loading,
}) => {
  const needsReviewCount = transactions.filter(t => t.needs_review).length
  const getAccountName  = (id) => accounts.find(a => a.id === id)?.name || '—'
  const getPayeeName    = (id) => payees.find(p => p.id === id)?.name   || '—'
  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '—'

  if (loading) return <p className="loading-text">Carregando transações...</p>

  return (
    <div className="transaction-list">
      {needsReviewCount > 0 && (
        <div className="review-banner">
          <AlertTriangle size={16} />
          <span>
            {needsReviewCount} transaç{needsReviewCount === 1 ? 'ão precisa' : 'ões precisam'} de revisão
          </span>
          <button className="action-btn sm" onClick={onApplyRules}>Aplicar Regras</button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state"><p>Nenhuma transação encontrada.</p></div>
      ) : (
        <table className="tx-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pagador</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th className="tx-amount-col">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className={tx.needs_review ? 'needs-review' : ''}>
                <td className="tx-date">
                  {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </td>
                <td className="tx-payee">
                  {getPayeeName(tx.payee_id)}
                  {tx.needs_review && <AlertTriangle size={12} className="review-icon" title="Aguardando revisão" />}
                </td>
                <td className="tx-category">{getCategoryName(tx.category_id)}</td>
                <td className="tx-account">{getAccountName(tx.account_id)}</td>
                <td className={`tx-amount ${tx.amount < 0 ? 'expense' : 'income'}`}>
                  {centsToReal(tx.amount)}
                </td>
                <td className="tx-actions">
                  {tx.cleared && <CheckCircle size={14} className="cleared-icon" title="Conciliado" />}
                  <button className="icon-btn sm" onClick={() => onEdit(tx)} title="Editar"><Edit2 size={14} /></button>
                  <button className="icon-btn sm danger" onClick={() => onDelete(tx.id)} title="Excluir"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default TransactionList
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/TransactionList.jsx
git commit -m "feat: TransactionList"
```

---

### Task 11: TransactionForm.jsx

**Files:**
- Create: `src/components/Finance/TransactionForm.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Finance/TransactionForm.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { realToCents } from '../../lib/finUtils'
import RelationChips from '../Activities/RelationChips'

const today = () => new Date().toISOString().split('T')[0]

const TransactionForm = ({
  transaction,
  accounts,
  payees,
  groups,
  categories,
  clients = [],
  tasks = [],
  team = [],
  onSave,
  onClose,
  addPayee,
}) => {
  const [form, setForm] = useState({
    account_id: '',
    amount: 0,
    date: today(),
    payee_id: null,
    payee_name: '',   // campo efêmero para rules engine; não vai para o DB
    category_id: null,
    notes: '',
    related_to: [],
    cleared: false,
  })
  const [amountInput, setAmountInput] = useState('')
  const [payeeSearch, setPayeeSearch] = useState('')
  const [showPayeeDropdown, setShowPayeeDropdown] = useState(false)
  const [creatingPayee, setCreatingPayee] = useState(false)

  useEffect(() => {
    if (transaction) {
      setForm({
        account_id:  transaction.account_id  || '',
        amount:      transaction.amount       || 0,
        date:        transaction.date         || today(),
        payee_id:    transaction.payee_id     || null,
        payee_name:  '',
        category_id: transaction.category_id  || null,
        notes:       transaction.notes        || '',
        related_to:  transaction.related_to   || [],
        cleared:     transaction.cleared      || false,
      })
      // Preservar sinal: despesas mostram "-150,00"; toFixed(2) garante duas casas decimais
      setAmountInput(transaction.amount != null
        ? (transaction.amount / 100).toFixed(2).replace('.', ',')
        : '')
      setPayeeSearch(payees.find(p => p.id === transaction.payee_id)?.name || '')
    } else if (accounts.length > 0) {
      setForm(p => ({ ...p, account_id: accounts[0].id }))
    }
  }, [transaction, accounts, payees])

  const change = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const handlePayeeSelect = (payee) => {
    change('payee_id', payee.id)
    change('payee_name', payee.name)
    setPayeeSearch(payee.name)
    setShowPayeeDropdown(false)
  }

  const handleCreatePayee = async () => {
    if (!payeeSearch.trim() || !addPayee || creatingPayee) return
    setCreatingPayee(true)
    const newPayee = await addPayee(payeeSearch.trim())
    setCreatingPayee(false)
    if (newPayee) handlePayeeSelect(newPayee)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.account_id || !amountInput.trim()) return
    const cents = realToCents(amountInput)
    if (cents === 0) return
    onSave({ ...form, amount: cents })
  }

  const filteredPayees = payees.filter(p =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase())
  )
  const visibleCategories = categories.filter(c => !c.hidden)
  const exactMatch = filteredPayees.some(p => p.name.toLowerCase() === payeeSearch.toLowerCase())

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal modal-wide"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{transaction ? 'Editar Transação' : 'Nova Transação'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Conta *</label>
              <select
                value={form.account_id}
                onChange={e => change('account_id', Number(e.target.value))}
              >
                <option value="">Selecione...</option>
                {accounts.filter(a => a.is_active).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Valor (R$) *</label>
              <input
                type="text"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="150,00 ou -150,00"
              />
              <small className="form-hint">Negativo = despesa. Ex: -150,00</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => change('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select
                value={form.category_id || ''}
                onChange={e => change('category_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Sem categoria</option>
                {groups.map(group => (
                  <optgroup key={group.id} label={group.name}>
                    {visibleCategories.filter(c => c.group_id === group.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Pagador</label>
            <div className="payee-input-wrapper">
              <input
                type="text"
                value={payeeSearch}
                onChange={e => {
                  setPayeeSearch(e.target.value)
                  setShowPayeeDropdown(true)
                  change('payee_id', null)
                  change('payee_name', e.target.value)
                }}
                onFocus={() => setShowPayeeDropdown(true)}
                placeholder="Buscar ou criar pagador..."
                autoComplete="off"
              />
              {showPayeeDropdown && payeeSearch.trim() && (
                <div className="payee-dropdown">
                  {filteredPayees.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="payee-option"
                      onClick={() => handlePayeeSelect(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                  {!exactMatch && (
                    <button type="button" className="payee-option create" onClick={handleCreatePayee}>
                      <Plus size={12} /> Criar &quot;{payeeSearch}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => change('notes', e.target.value)}
              placeholder="Observações..."
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Vínculos</label>
            <RelationChips
              value={form.related_to}
              onChange={v => change('related_to', v)}
              clients={clients}
              tasks={tasks}
              team={team}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.cleared}
                onChange={e => change('cleared', e.target.checked)}
              />
              Conciliado
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn" disabled={creatingPayee}>
              {creatingPayee ? 'Criando pagador...' : transaction ? 'Salvar' : 'Criar Transação'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default TransactionForm
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/TransactionForm.jsx
git commit -m "feat: TransactionForm com payee inline e RelationChips"
```

---

### Task 12: RuleBuilder.jsx

**Files:**
- Create: `src/components/Finance/RuleBuilder.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Finance/RuleBuilder.jsx
import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'

const CONDITION_FIELDS = [
  { value: 'payee_name', label: 'Pagador'           },
  { value: 'amount',     label: 'Valor (centavos)'  },
  { value: 'notes',      label: 'Notas'             },
  { value: 'account_id', label: 'Conta ID'          },
  { value: 'date',       label: 'Data'              },
]

// Operadores por campo — conforme tabela da spec (evitar oferecer ops inválidas)
const FIELD_OPS = {
  payee_name: [
    { value: 'contains',       label: 'contém'              },
    { value: 'not_contains',   label: 'não contém'          },
    { value: 'is',             label: 'é exatamente'        },
    { value: 'is_not',         label: 'não é'               },
    { value: 'starts_with',    label: 'começa com'          },
    { value: 'matches_regexp', label: 'corresponde a regexp'},
  ],
  amount: [
    { value: 'is',           label: 'é igual a' },
    { value: 'greater_than', label: 'maior que'  },
    { value: 'less_than',    label: 'menor que'  },
  ],
  notes: [
    { value: 'contains',     label: 'contém'     },
    { value: 'not_contains', label: 'não contém' },
    { value: 'is',           label: 'é exatamente' },
    { value: 'starts_with',  label: 'começa com'   },
  ],
  account_id: [
    { value: 'is',     label: 'é'    },
    { value: 'is_not', label: 'não é'},
  ],
  date: [
    { value: 'greater_than', label: 'após'  },
    { value: 'less_than',    label: 'antes' },
  ],
}

const ACTION_TYPES = [
  { value: 'set_category', label: 'Definir categoria'       },
  { value: 'rename_payee', label: 'Renomear pagador'        },
  { value: 'set_notes',    label: 'Definir notas'           },
  { value: 'set_cleared',  label: 'Marcar como conciliado'  },
  { value: 'flag_review',  label: 'Marcar para revisão'     },
]

const getOps = (field) => FIELD_OPS[field] || FIELD_OPS.payee_name

const RuleBuilder = ({ rule, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name:       rule?.name       || '',
    conditions: rule?.conditions || [],
    actions:    rule?.actions    || [],
    priority:   rule?.priority   ?? 0,
    is_active:  rule?.is_active  ?? true,
  })

  const addCondition = () => setForm(p => ({
    ...p,
    conditions: [...p.conditions, { field: 'payee_name', op: 'contains', value: '' }]
  }))

  const updateCondition = (i, patch) => setForm(p => ({
    ...p,
    conditions: p.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c)
  }))

  const removeCondition = (i) => setForm(p => ({
    ...p,
    conditions: p.conditions.filter((_, idx) => idx !== i)
  }))

  const addAction = () => setForm(p => ({
    ...p,
    actions: [...p.actions, { type: 'set_category', value: '' }]
  }))

  const updateAction = (i, patch) => setForm(p => ({
    ...p,
    actions: p.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a)
  }))

  const removeAction = (i) => setForm(p => ({
    ...p,
    actions: p.actions.filter((_, idx) => idx !== i)
  }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form className="rule-builder" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>Nome da Regra *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Supermercado → Alimentação"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Prioridade</label>
          <input
            type="number"
            value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))}
          />
        </div>
        <div className="form-group rule-active-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            />
            Ativa
          </label>
        </div>
      </div>

      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Condições (todas devem ser verdadeiras)</h4>
          <button type="button" className="icon-btn sm" onClick={addCondition} title="Adicionar condição">
            <Plus size={14} />
          </button>
        </div>
        {form.conditions.map((c, i) => (
          <div key={i} className="rule-row">
            <select
              value={c.field}
              onChange={e => updateCondition(i, { field: e.target.value, op: getOps(e.target.value)[0].value })}
            >
              {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={c.op} onChange={e => updateCondition(i, { op: e.target.value })}>
              {getOps(c.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text"
              value={c.value}
              onChange={e => updateCondition(i, { value: e.target.value })}
              placeholder="valor"
            />
            <button type="button" className="icon-btn sm danger" onClick={() => removeCondition(i)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {form.conditions.length === 0 && (
          <p className="empty-text">Nenhuma condição. Clique em + para adicionar.</p>
        )}
      </div>

      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Ações</h4>
          <button type="button" className="icon-btn sm" onClick={addAction} title="Adicionar ação">
            <Plus size={14} />
          </button>
        </div>
        {form.actions.map((a, i) => (
          <div key={i} className="rule-row">
            <select value={a.type} onChange={e => updateAction(i, { type: e.target.value })}>
              {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              value={a.value}
              onChange={e => updateAction(i, { value: e.target.value })}
              placeholder={
                a.type === 'set_cleared' || a.type === 'flag_review' ? 'true ou false' : 'valor'
              }
            />
            <button type="button" className="icon-btn sm danger" onClick={() => removeAction(i)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {form.actions.length === 0 && (
          <p className="empty-text">Nenhuma ação. Clique em + para adicionar.</p>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="action-btn" onClick={onCancel}>
          <X size={14} /> Cancelar
        </button>
        <button type="submit" className="add-member-btn">
          <Check size={14} /> Salvar Regra
        </button>
      </div>
    </form>
  )
}

export default RuleBuilder
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/RuleBuilder.jsx
git commit -m "feat: RuleBuilder — editor visual de condições e ações"
```

---

### Task 13: FinanceView.jsx

**Files:**
- Create: `src/components/Finance/FinanceView.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Finance/FinanceView.jsx
import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Wallet } from 'lucide-react'
import { useAccounts }       from '../../hooks/useAccounts'
import { usePayees }         from '../../hooks/usePayees'
import { useFinCategories }  from '../../hooks/useFinCategories'
import { useFinRules }       from '../../hooks/useFinRules'
import { useTransactions }   from '../../hooks/useTransactions'
import AccountCard     from './AccountCard'
import AccountForm     from './AccountForm'
import TransactionList from './TransactionList'
import TransactionForm from './TransactionForm'
import RuleBuilder     from './RuleBuilder'

const FinanceView = ({ clients = [], tasks = [], team = [] }) => {
  const [activeTab, setActiveTab] = useState('extrato')
  const [extractoFilters, setExtractoFilters] = useState({})
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editingTransaction, setEditingTransaction]   = useState(null)
  const [showAccountForm, setShowAccountForm]         = useState(false)
  const [editingAccount, setEditingAccount]           = useState(null)
  const [editingRule, setEditingRule]                 = useState(null) // rule | 'new' | null

  const { accounts, addAccount, updateAccount }             = useAccounts()
  const { payees, addPayee }                                = usePayees()
  const { groups, categories }                              = useFinCategories()
  const { rules, addRule, updateRule, deleteRule }          = useFinRules()

  // Estratégia de filtros:
  // - Contas/Regras: effectiveFilters = {} → carrega TODAS as transações → balances corretos
  // - Extrato: effectiveFilters = extractoFilters → display filtrado
  // O balance só é exibido na aba Contas (quando filters = {}), portanto nunca fica incorreto.
  const effectiveFilters = activeTab === 'extrato' ? extractoFilters : {}
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction, applyRules }
    = useTransactions(effectiveFilters, rules)

  const balances = useMemo(() => {
    const map = {}
    accounts.forEach(acc => {
      map[acc.id] = acc.opening_balance +
        transactions
          .filter(t => t.account_id === acc.id)
          .reduce((sum, t) => sum + t.amount, 0)
    })
    return map
  }, [accounts, transactions])

  const handleSaveTransaction = async (form) => {
    if (editingTransaction) await updateTransaction(editingTransaction.id, form)
    else await addTransaction(form)
    setShowTransactionForm(false)
    setEditingTransaction(null)
  }

  const handleSaveAccount = async (form) => {
    if (editingAccount) await updateAccount(editingAccount.id, form)
    else await addAccount(form)
    setShowAccountForm(false)
    setEditingAccount(null)
  }

  const handleSaveRule = async (form) => {
    if (editingRule && editingRule !== 'new') await updateRule(editingRule.id, form)
    else await addRule(form)
    setEditingRule(null)
  }

  const activeAccounts = accounts.filter(a => a.is_active)
  const tabs = ['extrato', 'contas', 'regras']

  return (
    <div className="finance-view">
      <div className="view-header">
        <h3>Finanças</h3>
        <div className="view-controls">
          <div className="tabs">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="actions">
            {activeTab === 'extrato' && (
              <button
                className="add-member-btn"
                onClick={() => { setEditingTransaction(null); setShowTransactionForm(true) }}
              >
                <Plus size={16} /> Nova Transação
              </button>
            )}
            {activeTab === 'contas' && (
              <button
                className="add-member-btn"
                onClick={() => { setEditingAccount(null); setShowAccountForm(true) }}
              >
                <Plus size={16} /> Nova Conta
              </button>
            )}
            {activeTab === 'regras' && (
              <button className="add-member-btn" onClick={() => setEditingRule('new')}>
                <Plus size={16} /> Nova Regra
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="board-container">
        {/* TAB: Extrato */}
        {activeTab === 'extrato' && (
          <>
            {/* Filtros por conta / período / categoria — spec linha 314 */}
            <div className="finance-filters">
              <select
                value={extractoFilters.accountId ?? ''}
                onChange={e => setExtractoFilters(f => ({
                  ...f, accountId: e.target.value ? Number(e.target.value) : undefined
                }))}
              >
                <option value="">Todas as contas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input
                type="date"
                value={extractoFilters.dateFrom ?? ''}
                onChange={e => setExtractoFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
                placeholder="De"
              />
              <input
                type="date"
                value={extractoFilters.dateTo ?? ''}
                onChange={e => setExtractoFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
                placeholder="Até"
              />
              <select
                value={extractoFilters.categoryId ?? ''}
                onChange={e => setExtractoFilters(f => ({
                  ...f, categoryId: e.target.value ? Number(e.target.value) : undefined
                }))}
              >
                <option value="">Todas as categorias</option>
                {categories.filter(c => !c.hidden).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {Object.values(extractoFilters).some(Boolean) && (
                <button className="action-btn sm" onClick={() => setExtractoFilters({})}>
                  Limpar filtros
                </button>
              )}
            </div>
            <TransactionList
              transactions={transactions}
              accounts={accounts}
              payees={payees}
              categories={categories}
              onEdit={(tx) => { setEditingTransaction(tx); setShowTransactionForm(true) }}
              onDelete={deleteTransaction}
              onApplyRules={applyRules}
              loading={txLoading}
            />
          </>
        )}

        {/* TAB: Contas */}
        {activeTab === 'contas' && (
          <div className="accounts-grid">
            {activeAccounts.length === 0 ? (
              <div className="empty-state">
                <Wallet size={28} />
                <p>Nenhuma conta. Clique em &quot;Nova Conta&quot; para começar.</p>
              </div>
            ) : (
              activeAccounts.map(acc => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  balance={balances[acc.id] ?? acc.opening_balance}
                  onClick={() => { setEditingAccount(acc); setShowAccountForm(true) }}
                />
              ))
            )}
          </div>
        )}

        {/* TAB: Regras */}
        {activeTab === 'regras' && (
          <div className="rules-list">
            {editingRule === 'new' && (
              <div className="rule-item editing">
                <RuleBuilder rule={null} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
              </div>
            )}
            {rules.length === 0 && editingRule !== 'new' && (
              <div className="empty-state">
                <p>Nenhuma regra. Regras automatizam a categorização das transações.</p>
              </div>
            )}
            {rules.map(rule => (
              <div key={rule.id} className={`rule-item ${editingRule?.id === rule.id ? 'editing' : ''}`}>
                {editingRule?.id === rule.id ? (
                  <RuleBuilder
                    rule={rule}
                    onSave={handleSaveRule}
                    onCancel={() => setEditingRule(null)}
                  />
                ) : (
                  <div className="rule-summary">
                    <div className="rule-info">
                      <span className="rule-name">{rule.name}</span>
                      <span className={`rule-status ${rule.is_active ? 'active' : 'inactive'}`}>
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className="rule-priority">Prioridade {rule.priority}</span>
                      <span className="rule-meta">
                        {rule.conditions.length} condição(ões) · {rule.actions.length} ação(ões)
                      </span>
                    </div>
                    <div className="rule-actions">
                      <button className="action-btn sm" onClick={() => setEditingRule(rule)}>Editar</button>
                      <button className="action-btn sm danger" onClick={() => deleteRule(rule.id)}>Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      <AnimatePresence>
        {showTransactionForm && (
          <TransactionForm
            transaction={editingTransaction}
            accounts={accounts}
            payees={payees}
            groups={groups}
            categories={categories}
            clients={clients}
            tasks={tasks}
            team={team}
            onSave={handleSaveTransaction}
            onClose={() => { setShowTransactionForm(false); setEditingTransaction(null) }}
            addPayee={addPayee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountForm && (
          <AccountForm
            account={editingAccount}
            onSave={handleSaveAccount}
            onClose={() => { setShowAccountForm(false); setEditingAccount(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default FinanceView
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: Build sem erros. FinanceView ainda não está no App.jsx, mas todos os imports devem resolver.

- [ ] **Step 3: Commit**

```bash
git add src/components/Finance/FinanceView.jsx
git commit -m "feat: FinanceView — container do módulo financeiro com 3 tabs"
```

---

## Chunk 3: CSS + Integration

### Task 14: CSS — Finance Module

**Files:**
- Modify: `src/index.css` (adicionar ao final, linha ~2416)

- [ ] **Step 1: Adicionar ao final de src/index.css**

```css
/* =====================================================
   FINANCE MODULE
   ===================================================== */

.finance-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* --- Accounts grid --- */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 4px;
}

.account-card {
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.account-card:hover { box-shadow: var(--shadow-hover); transform: translateY(-1px); }
.account-card.negative { border-color: var(--danger); }

.account-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.account-icon { color: var(--primary); }
.account-type-badge {
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: var(--bg-main);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.account-name { font-weight: 600; font-size: 1rem; color: var(--text-main); }
.account-balance { font-size: 1.25rem; font-weight: 700; }
.account-balance.positive { color: var(--success); }
.account-balance.negative { color: var(--danger); }

/* --- Transaction list --- */
.transaction-list { display: flex; flex-direction: column; gap: 0; }

.review-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #F59E0B22;
  color: #D97706;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  font-size: 0.875rem;
}
.review-banner .action-btn.sm { margin-left: auto; }

.tx-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.tx-table th {
  text-align: left;
  padding: 8px 12px;
  color: var(--text-secondary);
  border-bottom: var(--border-width) solid var(--border-color);
  font-weight: 500;
}
.tx-table td {
  padding: 10px 12px;
  border-bottom: var(--border-width) solid var(--border-color);
  color: var(--text-main);
}
.tx-table tr.needs-review { background: #F59E0B0A; }
.tx-table tr:hover { background: var(--bg-main); }

.tx-amount { font-weight: 600; text-align: right; }
.tx-amount.income  { color: var(--success); }
.tx-amount.expense { color: var(--danger);  }
.tx-amount-col { text-align: right; }
.tx-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.cleared-icon { color: var(--success); }
.review-icon  { color: #D97706; margin-left: 4px; vertical-align: middle; }

/* --- Rules list --- */
.rules-list { display: flex; flex-direction: column; gap: 8px; }

.rule-item {
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
}
.rule-item.editing { border-color: var(--primary); }

.rule-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}
.rule-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rule-name { font-weight: 600; color: var(--text-main); }
.rule-status { font-size: 0.75rem; padding: 2px 8px; border-radius: var(--radius-full); }
.rule-status.active   { background: #05CD9922; color: #05CD99; }
.rule-status.inactive { background: var(--bg-main); color: var(--text-secondary); }
.rule-priority { font-size: 0.75rem; color: var(--text-secondary); }
.rule-meta     { font-size: 0.75rem; color: var(--text-secondary); }
.rule-actions  { display: flex; gap: 8px; }

/* --- Rule builder --- */
.rule-builder { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.rule-section { display: flex; flex-direction: column; gap: 8px; }
.rule-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rule-section-header h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.rule-row { display: flex; gap: 8px; align-items: center; }
.rule-row select,
.rule-row input { flex: 1; min-width: 0; }
.rule-active-toggle { justify-content: flex-end; padding-top: 20px; }

/* --- Payee inline dropdown --- */
.payee-input-wrapper { position: relative; }
.payee-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}
.payee-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--text-main);
  font-size: 0.875rem;
}
.payee-option:hover { background: var(--bg-main); }
.payee-option.create { color: var(--primary); font-style: italic; }

/* --- Client transactions section --- */
.client-transactions-section {
  padding: 20px;
  border-top: var(--border-width) solid var(--border-color);
}
.client-transactions-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

/* --- Shared helpers (Finance scope) --- */
.action-btn.sm  { font-size: 0.8rem; padding: 4px 10px; }
.icon-btn.sm    { width: 24px; height: 24px; padding: 4px; }
.icon-btn.danger       { color: var(--danger); }
.icon-btn.danger:hover { background: #ef444422; }
.action-btn.danger       { color: var(--danger); border-color: var(--danger); }
.action-btn.danger:hover { background: #ef444422; }
.modal-wide     { max-width: 680px; }
.form-hint      { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.875rem; color: var(--text-main); }
.checkbox-label input[type="checkbox"] { width: auto; }
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: CSS do módulo financeiro"
```

---

### Task 15: Sidebar.jsx — adicionar item Finanças

**Files:**
- Modify: `src/components/Sidebar.jsx`

Arquivo atual (45 linhas). Array `menuItems` começa na linha 4.

- [ ] **Step 1: Adicionar ícone Wallet ao import**

Localizar linha 1:
```js
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity } from 'lucide-react';
```

Substituir por:
```js
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity, Wallet } from 'lucide-react';
```

- [ ] **Step 2: Adicionar item no array menuItems após Atividades**

Localizar:
```js
    { id: 'atividades', label: 'Atividades', icon: Activity },
    { id: 'time', label: 'Time', icon: Users },
```

Substituir por:
```js
    { id: 'atividades', label: 'Atividades', icon: Activity },
    { id: 'financas',   label: 'Finanças',   icon: Wallet   },
    { id: 'time',       label: 'Time',        icon: Users    },
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: item Finanças na sidebar"
```

---

### Task 16: App.jsx — wireup FinanceView

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Adicionar import de FinanceView**

Logo após a linha:
```js
import ActivitiesView from './components/Activities/ActivitiesView'
```

Adicionar:
```js
import FinanceView from './components/Finance/FinanceView'
```

- [ ] **Step 2: Adicionar case em getPageTitle()**

No switch de `getPageTitle()`, após:
```js
      case 'atividades': return 'Atividades'
```

Adicionar:
```js
      case 'financas': return 'Finanças'
```

- [ ] **Step 3: Adicionar case em renderContent()**

No switch de `renderContent()`, após:
```js
      case 'atividades':
        return <ActivitiesView clients={clients} tasks={tasks} team={team} searchQuery={searchQuery} />
```

Adicionar:
```js
      case 'financas':
        return <FinanceView clients={clients} tasks={tasks} team={team} />
```

- [ ] **Step 3b: Passar `tasks` ao `<TaskModal>` (necessário para Task 18)**

`TaskModal` precisará de `tasks` em Task 18 para o `RelationChips` do `TransactionForm`. App.jsx já tem `tasks` em estado mas não o repassa ao `TaskModal`. Localizar:
```jsx
            defaultStatus={addModalStatus}
            team={team}
            clients={clients}
          />
```

Substituir por:
```jsx
            defaultStatus={addModalStatus}
            team={team}
            clients={clients}
            tasks={tasks}
          />
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: Build sem erros.

- [ ] **Step 5: Abrir no browser e verificar**

```bash
npm run dev
```

- [ ] Sidebar mostra "Finanças" com ícone Wallet entre Atividades e Time
- [ ] Clicar em Finanças renderiza FinanceView com tabs Extrato / Contas / Regras
- [ ] Tab Contas: clicar "Nova Conta" abre AccountForm, preencher e salvar cria conta
- [ ] Tab Extrato: clicar "Nova Transação" abre TransactionForm
- [ ] Tab Regras: clicar "Nova Regra" mostra RuleBuilder inline

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: integrar FinanceView no App.jsx"
```

---

### Task 17: ClientProfileModal.jsx — seção Transações Vinculadas

**Files:**
- Modify: `src/components/Clients/ClientProfileModal.jsx`

Arquivo atual (141 linhas). Estrutura: `RecordSidebar > profile-body > profile-sidebar + interaction-feed`.

- [ ] **Step 1: Adicionar imports no topo do arquivo**

Após os imports existentes:
```js
import { useTransactions }  from '../../hooks/useTransactions'
import { useAccounts }      from '../../hooks/useAccounts'
import { usePayees }        from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import TransactionList      from '../Finance/TransactionList'
```

- [ ] **Step 2: Adicionar hooks no componente**

Logo após:
```js
  const [loadingLogs, setLoadingLogs] = useState(false)
```

Adicionar:
```js
  // Transações vinculadas ao cliente (filtro por related_to via PostgREST cs)
  const clientFilter = client?.id ? { relatedTo: { type: 'client', id: client.id } } : {}
  const { transactions: clientTxs, loading: txLoading } = useTransactions(clientFilter)
  const { accounts }    = useAccounts()
  const { payees }      = usePayees()
  const { categories }  = useFinCategories()
```

- [ ] **Step 3: Adicionar seção Transações no JSX**

A seção deve ser irmã de `.profile-body` (não dentro dele) e permanecer dentro do guard `{client && (...)}`.
Localizar o fechamento do bloco `{client && (...)}` — os dois `</div>` que fecham `interaction-feed` e `profile-body` seguidos pelo `)}` que fecha o guard (as linhas não têm comentários JSX inline no arquivo real):
```jsx
          </div>
        </div>
      )}
    </RecordSidebar>
```

Inserir a nova seção **entre o fechamento do `profile-body` e o `)}` do guard**:
```jsx
      {client && (
        <div className="client-transactions-section">
          <h3>Transações Vinculadas</h3>
          <TransactionList
            transactions={clientTxs}
            accounts={accounts}
            payees={payees}
            categories={categories}
            onEdit={() => {}}
            onDelete={() => {}}
            onApplyRules={() => {}}
            loading={txLoading}
          />
        </div>
      )}
```

> **Nota:** As ações `onEdit` e `onDelete` ficam vazias nesta view — a seção é somente leitura. Um link para o módulo Finanças pode ser adicionado futuramente.

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

Abrir perfil de um cliente → verificar seção "Transações Vinculadas" aparece ao final do painel.

- [ ] **Step 6: Commit**

```bash
git add src/components/Clients/ClientProfileModal.jsx
git commit -m "feat: seção Transações Vinculadas no perfil do cliente"
```

---

### Task 18: TaskModal.jsx — botão Vincular Transação

**Files:**
- Modify: `src/components/Tasks/TaskModal.jsx`

Arquivo atual (177 linhas).

- [ ] **Step 1: Adicionar imports**

Linha 2 já tem `import { motion } from 'framer-motion'` — **estender** o import existente:
```js
import { motion, AnimatePresence } from 'framer-motion'
```

Após os demais imports existentes, adicionar:
```js
import { DollarSign } from 'lucide-react'
import TransactionForm      from '../Finance/TransactionForm'
import { useAccounts }      from '../../hooks/useAccounts'
import { usePayees }        from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import { useTransactions }  from '../../hooks/useTransactions'
```

- [ ] **Step 2: Adicionar `tasks` à assinatura de props e adicionar state/hooks**

A assinatura atual do componente é `({ task, onSave, onClose, defaultStatus, team = [], clients = [] })`.
Estender para incluir `tasks`:
```js
const TaskModal = ({ task, onSave, onClose, defaultStatus, team = [], clients = [], tasks = [] }) => {
```

Após o bloco `useState` do form (linha ~18), adicionar:
```js
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const { accounts }               = useAccounts()
  const { payees, addPayee }       = usePayees()
  const { groups, categories }     = useFinCategories()
  const { addTransaction }         = useTransactions()
```

- [ ] **Step 3: Adicionar handler**

Após `handleSubmit`:
```js
  const handleSaveTransaction = async (txForm) => {
    // Se a tarefa já foi salva, vincula automaticamente a ela via related_to
    const related = task?.id
      ? [{ type: 'task', id: task.id, label: task.title }]
      : []
    await addTransaction({ ...txForm, related_to: related })
    setShowTransactionForm(false)
  }
```

- [ ] **Step 4: Adicionar botão no modal-actions**

Localizar:
```jsx
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
```

Substituir por:
```jsx
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="action-btn" onClick={() => setShowTransactionForm(true)}>
              <DollarSign size={14} style={{ marginRight: 4 }} />Vincular Transação
            </button>
```

- [ ] **Step 5: Adicionar TransactionForm após o modal principal**

O componente retorna um único `<motion.div className="modal-overlay">`. Envolva o retorno em um Fragment `<>...</>` e adicione o TransactionForm logo após o primeiro modal:

```jsx
  return (
    <>
      <motion.div
        className="modal-overlay"
        ...
      >
        {/* conteúdo existente do TaskModal */}
      </motion.div>

      <AnimatePresence>
        {showTransactionForm && (
          <TransactionForm
            accounts={accounts}
            payees={payees}
            groups={groups}
            categories={categories}
            clients={clients}
            tasks={tasks}
            team={team}
            onSave={handleSaveTransaction}
            onClose={() => setShowTransactionForm(false)}
            addPayee={addPayee}
          />
        )}
      </AnimatePresence>
    </>
  )
```

- [ ] **Step 6: Verificar build**

```bash
npm run build
```

Esperado: Build sem erros.

- [ ] **Step 7: Verificar no browser**

Abrir TaskModal → botão "Vincular Transação" aparece nos actions → clicar abre TransactionForm sobreposto.

- [ ] **Step 8: Commit**

```bash
git add src/components/Tasks/TaskModal.jsx
git commit -m "feat: botão Vincular Transação no TaskModal"
```

---

### Task 19: Verificação Final

**Files:** nenhum

- [ ] **Step 1: Build de produção**

```bash
npm run build
```

Esperado: Build completo sem erros.

- [ ] **Step 2: Checklist visual completo**

```bash
npm run dev
```

- [ ] Sidebar: item "Finanças" com ícone Wallet entre Atividades e Time
- [ ] FinanceView → tab Extrato: tabela vazia + botão "Nova Transação"
- [ ] FinanceView → tab Contas: grid vazio + botão "Nova Conta"
- [ ] FinanceView → tab Regras: lista vazia + botão "Nova Regra"
- [ ] Nova Conta: preencher nome, tipo, saldo → salvar → AccountCard aparece com saldo correto
- [ ] Nova Transação: campos conta/valor/data/pagador/categoria/notas/RelationChips/conciliado
- [ ] Pagador inline: digitar nome → dropdown aparece → "Criar X" cria payee e pré-seleciona
- [ ] Transação com regras: criar regra (condição + ação) → nova transação que bate deve ser categorizada automaticamente
- [ ] Transação sem regra: `needs_review = true` → badge laranja na lista + banner "Aplicar Regras"
- [ ] Botão "Aplicar Regras": re-processa transações pendentes
- [ ] Perfil de cliente: seção "Transações Vinculadas" ao final
- [ ] TaskModal: botão "Vincular Transação" → abre TransactionForm sobreposto
- [ ] Todos os 4 temas (ledger, classic, dark, twenty): verificar legibilidade da tabela de transações e dos cards de conta

- [ ] **Step 3: Commit final**

Se houve ajustes visuais durante a verificação:

```bash
git add src/index.css
git commit -m "fix: ajustes CSS pós-verificação do módulo financeiro"
```
