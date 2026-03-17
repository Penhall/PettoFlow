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
- `RelationChips` — componente existente, reutilizado no `TransactionForm`; recebe `clients`, `tasks`, `team` como props vindas de `FinanceView` (que os recebe do `App.jsx` como já faz com outros módulos)
- `RecordSidebar` — componente existente, reutilizado para perfil de conta
- Padrão de hooks customizados (`useActivities`, etc.) seguido por `useAccounts`, `useTransactions`, `useFinRules`

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
- Utilitário: `realToCents(str)` → integer; retorna `0` se NaN/null

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
  is_income  BOOLEAN NOT NULL DEFAULT false,  -- todas as categorias do grupo herdam este valor
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### Tabela `fin_categories`

(Prefixo `fin_` evita conflito com `categories` das atividades)

`is_income` vive **somente no grupo** (`category_groups.is_income`). As categorias herdam o valor do grupo — não há `is_income` na tabela de categorias para evitar inconsistências.

```sql
CREATE TABLE public.fin_categories (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  group_id   BIGINT REFERENCES public.category_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden     BOOLEAN NOT NULL DEFAULT false
);
```

### Tabela `transactions`

```sql
CREATE TABLE public.transactions (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  account_id   BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,          -- centavos com sinal; negativo=despesa, positivo=receita
  date         DATE NOT NULL,
  payee_id     BIGINT REFERENCES public.payees(id) ON DELETE SET NULL,
  category_id  BIGINT REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  notes        TEXT,
  related_to   JSONB NOT NULL DEFAULT '[]', -- [{type, id, label}]
  cleared      BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para filtros comuns
CREATE INDEX idx_transactions_account_date ON public.transactions (account_id, date DESC);
CREATE INDEX idx_transactions_category     ON public.transactions (category_id);
CREATE INDEX idx_transactions_needs_review ON public.transactions (needs_review) WHERE needs_review = true;
```

### Tabela `fin_rules`

```sql
CREATE TABLE public.fin_rules (
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  priority    INTEGER NOT NULL DEFAULT 0,  -- menor número = maior prioridade
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
│   ├── finUtils.js               # centsToReal(), realToCents()
│   └── rulesEngine.js            # runRulesEngine() — funções puras, sem hooks
│
├── hooks/
│   ├── useAccounts.js            # CRUD de contas
│   ├── useTransactions.js        # CRUD + aplica rules ao criar; recebe rules como 2º parâmetro
│   ├── usePayees.js              # CRUD de payees
│   ├── useFinCategories.js       # CRUD de categorias financeiras
│   └── useFinRules.js            # CRUD de regras
│
└── components/
    └── Finance/
        ├── FinanceView.jsx        # Container com 3 tabs; recebe clients/tasks/team do App.jsx
        ├── TransactionList.jsx    # Tabela filtrada + botão "Aplicar Regras"
        ├── TransactionForm.jsx    # Modal criação/edição; recebe clients/tasks/team como props
        ├── AccountCard.jsx        # Card de conta com saldo calculado
        ├── AccountForm.jsx        # Modal criação/edição de conta
        └── RuleBuilder.jsx        # Editor visual de condições + ações
```

---

## Hooks API

### `useAccounts()`

```js
const {
  accounts,      // Account[]
  loading,
  addAccount,    // (account) => Promise<Account>
  updateAccount, // (id, updates) => Promise<Account>
  closeAccount,  // (id) => Promise<void>  — sets is_active=false
} = useAccounts()
```

**Saldo de uma conta** é calculado em `FinanceView` a partir dos dados já carregados:
```js
const balance = account.opening_balance +
  transactions
    .filter(t => t.account_id === account.id)
    .reduce((sum, t) => sum + t.amount, 0)
```
Não há `getBalance` no hook — a conta não conhece as transações; o cálculo fica no componente que tem ambos.

---

### `useTransactions(filters?, rules?)`

```js
// filters: { accountId?, categoryId?, dateFrom?, dateTo?, needsReview?, relatedTo?: {type, id} }
//   relatedTo usa o operador PostgREST `cs` (contains) sobre a coluna JSONB related_to
// rules: FinRule[] — passado por FinanceView (que obtém do useFinRules)
const {
  transactions,
  loading,
  addTransaction,      // aplica runRulesEngine(form, rules) antes de salvar
  updateTransaction,
  deleteTransaction,
  applyRules,          // () => Promise<void> — re-processa SOMENTE as transações atualmente carregadas com needs_review=true; erros logados por transação
} = useTransactions(filters, rules)
```

**Fluxo de `addTransaction(form)`:**
1. Chama `runRulesEngine(form, rules ?? [])` — regras ativas ordenadas por `priority ASC, id ASC` (desempate por id)
2. Todas as regras cujas condições batem são aplicadas em sequência (apply-all, não first-match-wins)
3. Se ao menos uma regra bateu: form enriquecido (category_id, notes, payee normalizado); salva com `needs_review = false`
4. Se nenhuma bateu: salva com `needs_review = true`

**Escopo de `applyRules()`:**
- Re-processa apenas as transações **atualmente no estado local** que têm `needs_review = true`
- Atualiza cada uma via `updateTransaction` com o resultado do `runRulesEngine`
- Não faz batch query para buscar transações fora do filtro atual — é uma operação explícita e limitada ao contexto carregado

---

### `useFinRules()`

```js
const {
  rules,        // FinRule[]
  loading,
  addRule,      // (rule) => Promise<FinRule>
  updateRule,   // (id, updates) => Promise<FinRule>
  deleteRule,   // (id) => Promise<void>
} = useFinRules()
```

Prioridade é um campo numérico editado diretamente no `RuleBuilder` — não há drag-and-drop nem `reorderRules`.

---

### `usePayees()`

```js
const {
  payees,      // Payee[]
  loading,
  addPayee,    // (name: string) => Promise<Payee>
  updatePayee, // (id, updates) => Promise<Payee>
} = usePayees()
```

`addPayee` retorna o payee criado imediatamente — o `TransactionForm` usa o ID retornado para pré-selecionar o novo payee antes de salvar a transação.

---

### `useFinCategories()`

```js
const {
  groups,      // CategoryGroup[]  — category_groups ordenados por sort_order
  categories,  // FinCategory[]    — fin_categories (todas, incluindo hidden)
  loading,
  addGroup,       // (group) => Promise<CategoryGroup>
  addCategory,    // (category) => Promise<FinCategory>
  updateCategory, // (id, updates) => Promise<FinCategory>
} = useFinCategories()
```

O componente que consome (ex: `TransactionForm`) filtra `categories.filter(c => !c.hidden)` para o select agrupado.

---

### `rulesEngine.js` — funções puras

```js
// Entrada: form (objeto transação parcial) + array de regras ativas
// rules deve chegar pré-ordenada pelo chamador (priority ASC, id ASC) — runRulesEngine não reordena internamente
// Saída: form enriquecido (mutação em cópia) + flag ruleMatched
runRulesEngine(transaction, rules)      // → { enriched, ruleMatched: boolean }

// Helpers internos (exportados para facilitar testes unitários manuais)
allConditionsMatch(conditions, transaction)  // → boolean
applyActions(actions, transaction)           // → transaction (cópia mutada)
evaluateCondition(condition, transaction)    // → boolean; erros retornam false
```

---

## UI & Navigation

### Sidebar
Novo item `{ id: 'financas', label: 'Finanças', icon: Wallet }` após "Atividades".

### `FinanceView`
Recebe `clients`, `tasks`, `team` do `App.jsx` (mesmo padrão de `ActivitiesView`).
Chama `useFinRules()` e passa `rules` para `useTransactions(filters, rules)`.

Tab interna com 3 views:

| Tab | Conteúdo |
|---|---|
| **Extrato** | `TransactionList` — filtros por conta/período/categoria, badge `needs_review`, botão "Aplicar Regras" |
| **Contas** | Grid de `AccountCard` — nome, tipo, saldo calculado, botão "Nova Conta" |
| **Regras** | Lista de `fin_rules` com `RuleBuilder` inline ao editar |

### `AccountCard`

Props: `account` (Account), `balance` (number — centavos, pré-calculado em `FinanceView`). O cálculo por conta acontece uma vez no container, não dentro de cada card.

### `TransactionForm`
Modal overlay (padrão existente). Recebe `clients`, `tasks`, `team` como props de `FinanceView`.

Campos:
- Conta (select de `accounts`)
- Valor (input R$ com conversão automática para centavos)
- Data
- Pagador (select de `payees` + criação inline)
- Categoria (select agrupado por `category_groups`)
- Notas
- `RelationChips` — `clients`, `tasks`, `team` vindos de props
- Toggle "Conciliado"

### `RuleBuilder`
Editor visual com duas seções:
- **Condições** — lista de linhas `[campo] [operador] [valor]` com botão `+`
- **Ações** — lista de linhas `[tipo] [valor]` com botão `+`
- Campo "Prioridade" (número inteiro) e toggle "Ativa"

### Integração com views existentes
- `ClientProfileModal` (RecordSidebar): nova seção "Transações" adicionada como card de largura total abaixo das duas colunas existentes (`profile-sidebar` + `interaction-feed`). Contém `TransactionList` com filtro `relatedTo: { type: 'client', id: client.id }`.
- `TaskModal`: campo opcional "Transação vinculada" — botão que abre `TransactionForm` em modal sobreposto ao `TaskModal`, pré-preenchido com `related_to: [{ type: 'task', id: task.id, label: task.title }]`.

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
- `runRulesEngine` nunca lança exceção — erros em `evaluateCondition` retornam `false` (condição não satisfeita, regra ignorada)
- `realToCents` retorna `0` para entradas inválidas (NaN, null, undefined)

---

## SQL Migration

Arquivo: `supabase_financial_module.sql`

Contém:
1. Criação das 6 tabelas (`accounts`, `payees`, `category_groups`, `fin_categories`, `transactions`, `fin_rules`)
2. Índices em `transactions` (`account_id + date`, `category_id`, `needs_review`)
3. RLS + policies (padrão do projeto)
4. Dados seed: `category_groups` e `fin_categories` com grupos padrão (Moradia, Alimentação, Transporte, Saúde, Receitas)

---

## Out of Scope

- Importação de OFX/CSV (futuro)
- Envelope budgeting (subsistema separado, spec futura)
- Relatórios financeiros (subsistema separado, spec futura)
- Sincronização bancária (SimpleFin/GoCardless)
- Multi-moeda
