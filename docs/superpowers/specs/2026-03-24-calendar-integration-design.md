# Design Spec: Calendário Unificado + Integração Cruzada

**Data:** 2026-03-24
**Status:** Aprovado (v2 — issues de revisão corrigidos)
**Branch alvo:** `feature/calendar-integration`

---

## 1. Contexto

PettoFlow é uma SPA React 18 + Vite com Supabase, CSS puro com variáveis CSS (sem Tailwind). Possui três módulos principais — Tarefas (Kanban/Lista), Atividades (Timeline) e Finanças (accounts, transactions, receivables) — sem integração entre eles além do fluxo Tarefa Vendas → A Receber → Transação já existente.

Esta spec define a implementação de uma **visualização de Calendário unificada** e de **integração cruzada bidirecional** entre os três módulos.

---

## 2. Abordagem Escolhida

**Camada de Eventos Unificada (Abordagem B):** um hook central `useCalendarEvents()` normaliza dados de 4 fontes (tasks, activities, receivables, transactions) em um formato único `CalendarEvent`. O FullCalendar consome apenas esse hook. Nenhum componente existente é quebrado — apenas estendido.

---

## 3. Mudanças no Schema de Banco (Supabase)

### 3.1 Tabela `tasks` — 1 coluna nova

```sql
ALTER TABLE tasks ADD COLUMN due_date TIMESTAMPTZ NULL;
```

Semântica: prazo de entrega da tarefa. Opcional. Quando preenchido, a tarefa aparece no calendário como evento futuro.

### 3.2 Tabela `receivables` — 3 mudanças

```sql
-- task_id passa a ser nullable (receivable pode vir de atividade)
ALTER TABLE receivables ALTER COLUMN task_id DROP NOT NULL;

-- nova FK para atividade de origem
-- BIGINT para alinhar com o tipo de activities.id no Supabase (BIGSERIAL)
ALTER TABLE receivables ADD COLUMN activity_id BIGINT REFERENCES activities(id) NULL;

-- previsão de recebimento (usado como data no calendário)
ALTER TABLE receivables ADD COLUMN due_date DATE NULL;

-- regra: ao menos uma origem deve estar preenchida
ALTER TABLE receivables ADD CONSTRAINT receivables_source_check
  CHECK (task_id IS NOT NULL OR activity_id IS NOT NULL);
```

**Nota de tipo:** `activity_id` usa `BIGINT` para alinhar com `activities.id` (BIGSERIAL), evitando cast implícito.

### 3.3 Tabelas `activities` e `transactions` — sem mudança

O campo `related_to` JSONB já existe em ambas e suporta entradas `{ type: string, id: number }`. Os novos fluxos de cross-linking usam esse campo existente.

---

## 4. Mudanças em Hooks Existentes

### 4.1 `useReceivables.js` — 3 mudanças

**a) Query SELECT — adicionar join `activities`**

```js
.select(`
  *,
  tasks ( title, category, client_id ),
  activities ( title, id ),
  accounts ( name )
`)
```

Necessário para que `ReceivablesList` e `invoiceReceivable` acessem o título correto para receivables de origem atividade.

**b) Nova função `createReceivableFromActivity`**

```js
/**
 * Cria um receivable originado de uma atividade.
 * @param {number} activityId
 * @param {number} amount - em centavos
 * @param {number} targetAccountId
 * @param {string|null} dueDate - YYYY-MM-DD
 */
const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('receivables')
    .insert([{ activity_id: activityId, amount, target_account_id: targetAccountId,
               status: 'pending', due_date: dueDate }])
    .select()
  if (error) { console.error('Error creating receivable from activity:', error); return null }
  await fetch()
  return data[0]
}
```

Chamada pelo `ActivityForm` quando o usuário escolhe "A Receber" no accordion financeiro.

**c) `invoiceReceivable` — suporte a receivables de atividade**

Atualizar as linhas que constroem o payload da transação:

```js
// Antes (só funcionava para receivables de task):
notes: `Faturamento: ${rec.tasks?.title ?? 'tarefa'}`,
related_to: [{ type: 'task', id: rec.task_id }],

// Depois (suporta task_id e activity_id):
const sourceName = rec.tasks?.title ?? rec.activities?.title ?? 'lançamento'
// type: 'activity' é consistente com getActivitiesFor() em useActivities.js
const sourceLink = rec.task_id
  ? { type: 'task', id: rec.task_id }
  : { type: 'activity', id: rec.activity_id }
notes: `Faturamento: ${sourceName}`,
related_to: [sourceLink],
```

### 4.2 `financeUtils.js` — atualizar `shouldCreateReceivable`

A função atual verifica idempotência por `task_id`. Adicionar suporte a `activity_id`:

```js
// Regra de idempotência estendida:
// - Para receivables de task: nenhum receivable existente com mesmo task_id
// - Para receivables de activity: nenhum receivable existente com mesmo activity_id
// - Receivables de atividade NUNCA são criados automaticamente (apenas via accordion explícito)
```

O auto-trigger (dnd-kit → terminal column) continua exclusivo para tarefas Vendas. Atividades **nunca** criam receivables automaticamente — só via accordion explícito no `ActivityForm`.

---

## 5. Hook Central — `useCalendarEvents`

**Arquivo:** `src/hooks/useCalendarEvents.js`

### 5.1 Interface

```js
// Opções (todas opcionais)
{
  types: ['task', 'activity', 'receivable', 'transaction'], // padrão: todos
  from: Date,   // filtro cliente-side (não server-side — todos os registros são carregados)
  to: Date,
}

// Retorno
{
  events: CalendarEvent[],
  loading: boolean,
  refresh: () => void,
}
```

**Nota de performance:** `from`/`to` são filtros **client-side** sobre os dados já carregados pelos hooks existentes. Não há paginação server-side nesta fase. Aceitável para o volume atual do projeto.

### 5.2 Formato normalizado `CalendarEvent`

```js
{
  id: string,          // ex: 'task-42', 'activity-7'
  title: string,
  date: string,        // ISO date YYYY-MM-DD
  endDate?: string,
  type: 'task' | 'activity' | 'receivable' | 'transaction',
  color: string,       // hex, por tipo/estado
  sourceId: number,    // id original
  sourceType: string,
  payload: object,     // objeto original completo
}
```

### 5.3 Mapeamento de fontes → eventos

| Fonte | Data usada | Condição de inclusão | Cor |
|-------|-----------|----------------------|-----|
| `tasks` (due_date) | `due_date` | `due_date` não nulo | `#3b82f6` (azul) |
| `tasks` (completed) | `completed_at` | `completed_at` não nulo | `#94a3b8` (cinza) |
| `activities` | `scheduled_at` | `scheduled_at` não nulo | `#8b5cf6` (roxo) |
| `receivables` | `due_date` ou `created_at` | `status === 'pending'` | `#f59e0b` (amarelo) |
| `transactions` (crédito) | `date` | `amount > 0` | `#10b981` (verde) |
| `transactions` (débito) | `date` | `amount < 0` | `#ef4444` (vermelho) |

**Nota sobre `completed_at`:** a condição de inclusão usa a **presença do campo** `completed_at`, não uma comparação de string com o nome da coluna terminal. O nome da coluna terminal é dinâmico (`kanban_columns` por order_index) e não deve ser hardcoded aqui.

### 5.4 Dependências internas

```js
const { activities, loading: actLoading } = useActivities()
const { receivables, loading: recLoading } = useReceivables()
const { rules } = useFinRules()                          // ← regras próprias do hook
const { transactions, loading: txLoading } = useTransactions({}, rules)
// tasks são passadas como prop para CalendarView e chegam ao hook via parâmetro
```

`useFinRules()` é chamado internamente pelo hook para que `useTransactions` receba as regras corretas, evitando que todas as transações sejam marcadas como `needs_review: true`.

---

## 6. Novos Componentes

### 6.1 `CalendarView.jsx`

**Arquivo:** `src/components/Calendar/CalendarView.jsx`

**Props:**
```js
{
  filterTypes?: string[], // limita tipos exibidos, ex: ['task'] para view de Tarefas
  tasks: Task[],          // passadas do App.jsx — usadas pelo hook e pelo ActivityForm
  clients: Client[],
  team: TeamMember[],
  columns: KanbanColumn[],
}
```

**Comportamento:**
- Renderiza `@fullcalendar/react` com `locale` importado de `@fullcalendar/core/locales/pt-br`
- `headerToolbar`: `{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listMonth' }` — setas ‹ › nativas do FullCalendar para navegação entre meses/semanas/períodos
- View padrão: `dayGridMonth`
- Ao clicar num evento: define `selectedEvent` e exibe `<EventDetailPanel>`
- Ao clicar numa data vazia (`dateClick`): abre `<ActivityForm>` com `scheduled_at` pré-preenchido; `ActivityForm` recebe `clients`, `tasks`, `team` via props já disponíveis em `CalendarView`
- Passa `{ types: filterTypes }` para `useCalendarEvents`
- `CalendarFilters` só é renderizado quando `filterTypes` é indefinido (visão unificada)

### 6.2 `EventDetailPanel.jsx`

**Arquivo:** `src/components/Calendar/EventDetailPanel.jsx`

Painel lateral (slide-in via `framer-motion`) que recebe um `CalendarEvent` e renderiza ações contextuais. Abre formulários existentes dentro de `<AnimatePresence>` modais, pré-preenchidos com `related_to` correto.

| Tipo | Ações |
|------|-------|
| `task` | **Editar** (abre TaskModal) · **Faturar** (abre inline invoice form, só se category=Vendas e receivable pending) · **Concluída** (chama `updateTask`) |
| `activity` | **Editar** (abre ActivityForm) · **Criar Transação** (abre TransactionForm com `related_to` pré-preenchido) · **Criar A Receber** (mini-form inline: valor + due_date) · **Concluir** (chama `updateActivity`) |
| `receivable` | **Faturar** (abre inline invoice form) · **Follow-up** (abre ActivityForm com `type:'call'` pré-preenchido) · **Criar Tarefa** (abre AddTaskModal pré-preenchido) |
| `transaction` (crédito) | **Criar Tarefa** (abre AddTaskModal) · **Criar Atividade** (abre ActivityForm) |
| `transaction` (débito) | **Criar Tarefa** (abre AddTaskModal) · **Criar Atividade** (abre ActivityForm) |

`EventDetailPanel` recebe `clients`, `tasks`, `team`, `columns` via props de `CalendarView` para passá-los aos formulários que abrir.

### 6.3 `CalendarFilters.jsx`

**Arquivo:** `src/components/Calendar/CalendarFilters.jsx`

Chips toggle para Tarefas / Atividades / A Receber / Transações. Estado local (não persiste no Supabase). Renderizado dentro do header de `CalendarView` — não é um painel lateral separado. Visível apenas quando `filterTypes` é indefinido (visão unificada da sidebar); oculto na view de Tarefas.

---

## 7. Modificações em Componentes Existentes

### 7.1 `TaskModal.jsx` e `AddTaskModal.jsx`

Adicionar campo `due_date` (input `date`, label "Prazo", opcional) na seção de Status/Prioridade.

### 7.2 `ActivityForm.jsx`

Adicionar accordion colapsável **"＋ Registrar valor financeiro"** abaixo dos vínculos:
- Radio: "Transação imediata" | "A Receber"
- Campo: valor (R$, usando `realToCents` de `finUtils`)
- Campo: data

Ao salvar a atividade com seção financeira aberta e valor preenchido:
- **Transação imediata:** chama `addTransaction` (recebido via prop de `ActivitiesView`) com `related_to: [{ type: 'activity', id: savedActivity.id }]`
- **A Receber:** chama `createReceivableFromActivity(savedActivity.id, amount, principalAccountId, dueDate)`; depois atualiza `related_to` da atividade com `{ type: 'receivable', id: newReceivable.id }`

`ActivitiesView` passa `addTransaction` (de `useTransactions`) e `createReceivableFromActivity` (de `useReceivables`) como props para `ActivityForm`.

### 7.3 `TransactionForm.jsx`

Adicionar accordion colapsável **"＋ Criar Tarefa ou Atividade vinculada"**:
- Botão **"Criar Tarefa"**: abre `AddTaskModal`; após salvar task, chama `updateTransaction(tx.id, { related_to: [...tx.related_to, { type: 'task', id: newTask.id }] })`
- Botão **"Criar Atividade"**: abre `ActivityForm` com `related_to: [{ type: 'transaction', id: tx.id }]` pré-preenchido

`TransactionForm` recebe `addActivity` (de `useActivities`) e `onUpdateTransaction` como props adicionais de `FinanceView`.

### 7.4 `ReceivablesList.jsx`

Adicionar 2 botões por linha ao lado do "Faturar" existente:
- **"Follow-up"** → abre `ActivityForm` com `type: 'call'` e `related_to: [{ type: 'receivable', id }]`
- **"Criar Tarefa"** → abre `AddTaskModal` com título sugerido (`"Cobrar: ${r.tasks?.title ?? r.activities?.title}"`)

`ReceivablesList` recebe `addActivity`, `tasks`, `clients`, `team`, `templates` via props de `FinanceView`.

### 7.5 `App.jsx`

- Adicionar case `'calendario'` no `renderContent()`
- Renderiza `<CalendarView clients={clients} tasks={tasks} team={team} columns={columns} />`

### 7.6 `Sidebar.jsx`

- Adicionar item "📅 Calendário" com `setActiveTab('calendario')`

### 7.7 View de Calendário dentro de Tarefas

Adicionar tab "📅 Calendário" nas views de Tarefas (ao lado de Kanban/Lista/Visão Geral/Arquivos):
- Renderiza `<CalendarView filterTypes={['task']} tasks={filteredTasks} clients={clients} team={team} columns={columns} />`

---

## 8. Estratégia de Testes (Vitest)

### 8.1 `useCalendarEvents` — testes unitários

Mockar os 4 hooks de dados (`vi.mock`) e verificar:

1. Task com `due_date` → evento azul na data correta
2. Task com `completed_at` → evento cinza (presença do campo, não comparação de string)
3. Task sem nenhum dos dois → não incluída
4. Activity com `scheduled_at` → evento roxo
5. Activity sem `scheduled_at` → não incluída
6. Receivable `pending` → evento amarelo (usa `due_date` se existir, senão `created_at`)
7. Receivable `invoiced` → não incluída
8. Transaction `amount > 0` → evento verde
9. Transaction `amount < 0` → evento vermelho
10. Filtro `types: ['task']` → retorna apenas tasks

### 8.2 `financeUtils` — estender testes existentes

Adicionar caso: receivable com `activity_id` (task_id = null) não deve gerar segundo receivable se já existe um com o mesmo `activity_id` (idempotência). Regra: `shouldCreateReceivable` não se aplica a atividades — atividades só criam receivable via chamada explícita, não há auto-trigger.

### 8.3 Integração cruzada — testes unitários

Para cada fluxo, mockar Supabase (`vi.fn()`) e verificar que os campos corretos são gravados:

| Fluxo | Verificação |
|-------|------------|
| Activity → Transaction | `transactions.insert` chamado com `related_to: [{type:'activity', id}]` |
| Activity → Receivable | `receivables.insert` com `activity_id` preenchido; `activities.update` com `related_to` contendo `{type:'receivable'}` |
| Transaction → Task | `tasks.insert` chamado; `transactions.update` com `related_to` atualizado com `{type:'task'}` |
| Transaction → Activity | `activities.insert` com `related_to: [{type:'transaction', id}]` |
| Receivable → Activity (follow-up) | `activities.insert` com `type:'call'` e `related_to: [{type:'receivable', id}]` |
| Receivable → Task | `tasks.insert` chamado com título sugerido correto |
| `invoiceReceivable` (activity source) | `transactions.insert` com `related_to: [{type:'activity', id}]` e `notes` usando `activities.title` |

---

## 9. Dependências a Instalar

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/core
```

O pacote `@fullcalendar/core/locales/pt-br` já vem incluído no `@fullcalendar/core`.

---

## 10. Ordem de Implementação

1. **Migração DB** — `due_date` em tasks + 3 mudanças em receivables
2. **Campos `due_date`** em TaskModal e AddTaskModal — feito cedo para popular dados de teste desde o início
3. **Atualizar `useReceivables`** — novo SELECT + `createReceivableFromActivity` + fix `invoiceReceivable`
4. **Hook `useCalendarEvents`** + testes unitários (seção 8.1)
5. **`CalendarView` + `CalendarFilters`** — aba sidebar (sem EventDetailPanel ainda); com `due_date` já populável, o layer de tasks fica visível imediatamente
6. **`EventDetailPanel`** — painel lateral com ações contextuais
7. **Aba Calendário dentro de Tarefas** — `filterTypes={['task']}`
8. **ActivityForm** — accordion financeiro
9. **TransactionForm** — accordion vincular
10. **ReceivablesList** — botões Follow-up e Criar Tarefa
11. **Testes de integração cruzada** (seção 8.3) + extensão financeUtils (seção 8.2)

---

## 11. Fora de Escopo (fase futura)

- Notificações/lembretes por WhatsApp ou Telegram
- Recorrência de eventos no calendário
- Arrastar eventos no calendário para reagendar (`editable: false` no FullCalendar)
- Exportação do calendário (iCal/Google Calendar)
- Filtros server-side por data (atualmente client-side)
