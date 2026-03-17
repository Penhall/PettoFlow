# Módulo Financeiro — Design Spec

**Data:** 2026-03-17
**Status:** Aprovado pelo usuário

---

## Goal

Adicionar um módulo financeiro nativo ao PettoFlow inspirado no modelo de dados do Actual Budget, implementado inteiramente em React 18 + Vite (JSX) + Supabase. Nenhuma dependência do pacote `@actual-app/api` — toda a lógica é reimplementada como código próprio.

## Architecture

**Abordagem:** Rules engine híbrido — regras avaliadas no frontend (hooks JS) ao criar/importar transações. Transações sem regra correspondente recebem `needs_review=true` e podem ser re-processadas sob demanda via botão "Aplicar Regras".

**Integração com entidades existentes:**
- `related_to: [{type, id, label}]` — padrão JSONB polimórfico já existente nas atividades, reutilizado em transações para vincular a clientes e/ou tarefas
- `RelationChips` — componente existente, reutilizado no `TransactionForm`
- `RecordSidebar` — componente existente, reutilizado para perfil de conta
- Padrão de hooks customizados (`useActivities`, etc.) seguido por `useAccounts`, `useTransactions`, `useRulesEngine`

---

## Tech Stack

- React 18 + Vite (JSX puro, sem TypeScript)
- Supabase JS v2 (PostgreSQL)
- Framer Motion (animações, padrão existente)
- Lucide React — ícone `Wallet` para a tab de Finanças
- CSS custom properties (4 temas: ledger, classic, dark, twenty)

---

## Data Model (Supabase)

### Convenção de amounts

Todos os valores monetários são armazenados como **inteiros em centavos**:
- `150000` = R$1.500,00
- `-5050` = R$-50,50 (despesa)
- Utilitário: `centsToReal(n)` → string formatada em BRL
- Utilitário: `realToCents(str)` → integer

### Tabela `accounts`

```sql
CREATE TABLE public.accounts (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('checking','savings','credit','cash')),
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela `payees`

```sql
CREATE TABLE public.payees (
  id                BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name              TEXT NOT NULL,
  learn_categories  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela `category_groups`

```sql
CREATE TABLE public.category_groups (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  is_income  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### Tabela `fin_categories`

(Prefixo `fin_` evita conflito com `categories` das atividades)

```sql
CREATE TABLE public.fin_categories (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  group_id   BIGINT REFERENCES public.category_groups(id) ON DELETE CASCADE,
  is_income  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden     BOOLEAN NOT NULL DEFAULT false
);
```

### Tabela `transactions`

```sql
CREATE TABLE public.transactions (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  account_id   BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,          -- centavos com sinal
  date         DATE NOT NULL,
  payee_id     BIGINT REFERENCES public.payees(id) ON DELETE SET NULL,
  category_id  BIGINT REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  notes        TEXT,
  related_to   JSONB NOT NULL DEFAULT '[]', -- [{type, id, label}]
  cleared      BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela `fin_rules`

```sql
CREATE TABLE public.fin_rules (
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  priority    INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Estrutura JSON das regras:**

```jsonc
// conditions — todas devem ser verdadeiras (AND implícito)
{
  "field": "payee_name" | "amount" | "notes" | "account_id" | "date",
  "op":   "contains" | "not_contains" | "is" | "is_not" |
          "greater_than" | "less_than" | "starts_with" | "matches_regexp",
  "value": <string | number>
}

// actions — todas são aplicadas quando condições batem
{
  "type":  "set_category" | "rename_payee" | "set_notes" |
           "set_cleared" | "flag_review",
  "value": <string | boolean>
}
```

**RLS:** todas as tabelas com políticas de acesso público (SELECT/INSERT/UPDATE/DELETE), padrão do projeto.

---

## File Structure

```
src/
├── lib/
│   └── finUtils.js               # centsToReal(), realToCents()
│   └── rulesEngine.js            # runRulesEngine() — funções puras, sem hooks
│
├── hooks/
│   ├── useAccounts.js            # CRUD de contas + cálculo de saldo
│   ├── useTransactions.js        # CRUD + aplica rules ao criar
│   ├── usePayees.js              # CRUD de payees
│   ├── useFinCategories.js       # CRUD de categorias financeiras
│   └── useFinRules.js            # CRUD de regras
│
└── components/
    └── Finance/
        ├── FinanceView.jsx        # Container com 3 tabs
        ├── TransactionList.jsx    # Tabela filtrada + botão "Aplicar Regras"
        ├── TransactionForm.jsx    # Modal criação/edição com RelationChips
        ├── AccountCard.jsx        # Card de conta com saldo
        ├── AccountForm.jsx        # Modal criação/edição de conta
        └── RuleBuilder.jsx        # Editor visual de condições + ações
```

---

## Hooks API

### `useAccounts()`

```js
const {
  accounts,           // Account[]
  loading,
  addAccount,         // (account) => Promise<Account>
  updateAccount,      // (id, updates) => Promise<Account>
  closeAccount,       // (id) => Promise<void>  — sets is_active=false
  getBalance,         // (accountId) => number  — opening_balance + soma de transactions
} = useAccounts()
```

### `useTransactions(filters?)`

```js
// filters: { accountId?, categoryId?, dateFrom?, dateTo?, needsReview? }
const {
  transactions,
  loading,
  addTransaction,      // aplica runRulesEngine antes de salvar
  updateTransaction,
  deleteTransaction,
  applyRules,          // re-processa todas com needs_review=true
} = useTransactions(filters)
```

**Fluxo de `addTransaction`:**
1. Chama `runRulesEngine(form, rules)` com as regras ativas ordenadas por prioridade
2. Se alguma regra bater: enriquece o form (category, notes, payee normalizado)
3. Salva no Supabase com `needs_review = !algumaRegraAtingiu`

### `useRulesEngine()`

```js
const { rules, addRule, updateRule, deleteRule, reorderRules } = useFinRules()
```

### `rulesEngine.js` — funções puras

```js
runRulesEngine(transaction, rules)  // → transaction enriquecida
allConditionsMatch(conditions, transaction)  // → boolean
applyActions(actions, transaction)  // → transaction mutada
evaluateCondition(condition, transaction)  // → boolean
```

---

## UI & Navigation

### Sidebar
Novo item `{ id: 'financas', label: 'Finanças', icon: Wallet }` após "Atividades".

### `FinanceView`
Tab interna com 3 views:

| Tab | Conteúdo |
|---|---|
| **Extrato** | `TransactionList` — filtros por conta/período/categoria, badge `needs_review`, botão "Aplicar Regras" |
| **Contas** | Grid de `AccountCard` — nome, tipo, saldo atual, botão "Nova Conta" |
| **Regras** | Lista de `fin_rules` com `RuleBuilder` inline ao editar |

### `TransactionForm`
Modal overlay (padrão existente). Campos:
- Conta (select de `accounts`)
- Valor (input com conversão automática cents ↔ R$)
- Data
- Pagador (select + criação inline de `payees`)
- Categoria (select agrupado por `category_groups`)
- Notas
- `RelationChips` para vincular a cliente/tarefa (reutiliza componente existente)
- Toggle "Conciliado"

### `RuleBuilder`
Editor visual com duas seções:
- **Condições** — lista de linhas `[campo] [operador] [valor]` com botão `+`
- **Ações** — lista de linhas `[tipo] [valor]` com botão `+`
- Campo "Prioridade" (número) e toggle "Ativa"

### Integração com views existentes
- `ClientProfileModal` (RecordSidebar): nova seção "Transações" com `TransactionList` filtrado por `related_to` do cliente
- `TaskModal`: campo opcional "Transação vinculada" abre `TransactionForm` pré-preenchido com `related_to` da tarefa

---

## Rules Engine — Operadores e Campos

| Campo | Operadores disponíveis |
|---|---|
| `payee_name` | `contains`, `not_contains`, `is`, `is_not`, `starts_with`, `matches_regexp` |
| `amount` | `greater_than`, `less_than`, `is` |
| `notes` | `contains`, `not_contains`, `is`, `starts_with` |
| `account_id` | `is`, `is_not` |
| `date` | `greater_than`, `less_than` |

| Ação | Efeito |
|---|---|
| `set_category` | Define `category_id` |
| `rename_payee` | Normaliza nome do payee |
| `set_notes` | Define/sobrescreve `notes` |
| `set_cleared` | Define `cleared = true` |
| `flag_review` | Força `needs_review = true` |

---

## Error Handling

- Padrão do projeto: `console.error(error)` + retorno `null`/`false` nas funções de hook
- `runRulesEngine` nunca lança exceção — erros de avaliação de condição retornam `false` (condição não satisfeita)
- Valores inválidos de amount (NaN, null) são convertidos para `0` por `realToCents`

---

## SQL Migration

Arquivo: `supabase_financial_module.sql`
Contém criação de todas as 6 tabelas + RLS + policies + dados seed para `category_groups` e `fin_categories` (grupos padrão: Moradia, Alimentação, Transporte, Saúde, Receitas).

---

## Out of Scope

- Importação de OFX/CSV (futuro)
- Envelope budgeting (subsistema separado, spec futura)
- Relatórios financeiros (subsistema separado, spec futura)
- Sincronização bancária (SimpleFin/GoCardless)
- Multi-moeda
