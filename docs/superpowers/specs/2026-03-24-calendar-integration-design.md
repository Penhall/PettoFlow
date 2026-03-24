# Design Spec: Calendário Unificado + Integração Cruzada

**Data:** 2026-03-24
**Status:** Aprovado
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
ALTER TABLE receivables ADD COLUMN activity_id INTEGER REFERENCES activities(id) NULL;

-- previsão de recebimento (usado como data no calendário)
ALTER TABLE receivables ADD COLUMN due_date DATE NULL;

-- regra: ao menos uma origem deve estar preenchida
ALTER TABLE receivables ADD CONSTRAINT receivables_source_check
  CHECK (task_id IS NOT NULL OR activity_id IS NOT NULL);
```

### 3.3 Tabelas `activities` e `transactions` — sem mudança

O campo `related_to` JSONB já existe em ambas e suporta entradas `{ type: string, id: number }`. Os novos fluxos de cross-linking usam esse campo existente.

---

## 4. Hook Central — `useCalendarEvents`

**Arquivo:** `src/hooks/useCalendarEvents.js`

### 4.1 Interface

```js
// Opções (todas opcionais)
{
  types: ['task', 'activity', 'receivable', 'transaction'], // padrão: todos
  from: Date,   // filtro de data inicial
  to: Date,     // filtro de data final
}

// Retorno
{
  events: CalendarEvent[],
  loading: boolean,
  refresh: () => void,
}
```

### 4.2 Formato normalizado `CalendarEvent`

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

### 4.3 Mapeamento de fontes → eventos

| Fonte | Data usada | Condição de inclusão | Cor |
|-------|-----------|----------------------|-----|
| `tasks` (due_date) | `due_date` | `due_date` não nulo | `#3b82f6` (azul) |
| `tasks` (completed) | `completed_at` | `completed_at` não nulo | `#94a3b8` (cinza) |
| `activities` | `scheduled_at` | `scheduled_at` não nulo | `#8b5cf6` (roxo) |
| `receivables` | `due_date` ou `created_at` | `status === 'pending'` | `#f59e0b` (amarelo) |
| `transactions` (crédito) | `date` | `amount > 0` | `#10b981` (verde) |
| `transactions` (débito) | `date` | `amount < 0` | `#ef4444` (vermelho) |

### 4.4 Dependências internas

Usa os hooks existentes sem criar novos fetches:
- `useActivities()`
- `useReceivables()`
- `useTransactions({}, rules)` — instância não filtrada

---

## 5. Novos Componentes

### 5.1 `CalendarView.jsx`

**Arquivo:** `src/components/Calendar/CalendarView.jsx`

**Props:**
```js
{
  filterTypes?: string[], // limita tipos exibidos, ex: ['task'] para view de Tarefas
  clients: [],
  tasks: [],
  team: [],
  columns: [],
}
```

**Comportamento:**
- Renderiza FullCalendar (`@fullcalendar/react`) com locale `pt-BR`
- `headerToolbar`: `{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listMonth' }` — inclui setas ‹ › para navegação entre meses/semanas
- Views disponíveis: Mês (padrão), Semana, Lista (próximos 30 dias)
- Ao clicar num evento: abre `EventDetailPanel` com o `CalendarEvent` selecionado
- Ao clicar numa data vazia: abre `ActivityForm` pré-preenchido com `scheduled_at`
- Passa `filterTypes` para `useCalendarEvents({ types: filterTypes })`

### 5.2 `EventDetailPanel.jsx`

**Arquivo:** `src/components/Calendar/EventDetailPanel.jsx`

Painel lateral (slide-in) que recebe um `CalendarEvent` e renderiza ações contextuais:

| Tipo | Ações disponíveis |
|------|--------------------|
| `task` | Editar · Faturar (se category=Vendas e receivable pendente) · Marcar concluída |
| `activity` | Editar · Criar Transação · Criar A Receber · Concluir |
| `receivable` | Faturar · Follow-up (cria atividade tipo `call`) · Criar Tarefa |
| `transaction` (crédito) | Criar Tarefa · Criar Atividade |
| `transaction` (débito) | Criar Tarefa · Criar Atividade |

Todas as ações abrem formulários existentes pré-preenchidos com `related_to` correto.

### 5.3 `CalendarFilters.jsx`

**Arquivo:** `src/components/Calendar/CalendarFilters.jsx`

Chips toggle para Tarefas / Atividades / A Receber / Transações. Estado local (não persiste). Exibido apenas na aba Calendário da sidebar — não na view de Tarefas.

---

## 6. Modificações em Componentes Existentes

### 6.1 `TaskModal.jsx` e `AddTaskModal.jsx`

Adicionar campo `due_date` (input `date`, label "Prazo", opcional) na linha de Status/Prioridade.

### 6.2 `ActivityForm.jsx`

Adicionar accordion colapsável **"＋ Registrar valor financeiro"** abaixo dos vínculos:
- Radio: "Transação imediata" | "A Receber"
- Campo: valor (R$)
- Campo: data

Ao salvar a atividade com valor financeiro preenchido:
- **Transação imediata:** cria transação com `related_to: [{ type: 'activity', id }]`
- **A Receber:** cria receivable com `activity_id` + adiciona `{ type: 'receivable', id }` ao `related_to` da atividade

### 6.3 `TransactionForm.jsx`

Adicionar accordion colapsável **"＋ Criar Tarefa ou Atividade vinculada"**:
- Botão "Criar Tarefa" → abre `AddTaskModal` pré-preenchido; após salvar, atualiza `related_to` da transação
- Botão "Criar Atividade" → abre `ActivityForm` com `related_to: [{ type: 'transaction', id }]`

### 6.4 `ReceivablesList.jsx`

Adicionar 2 botões por linha ao lado do "Faturar" existente:
- **"Follow-up"** → abre `ActivityForm` com `type: 'call'` e `related_to: [{ type: 'receivable', id }]`
- **"Criar Tarefa"** → abre `AddTaskModal` com `related_to: [{ type: 'receivable', id }]`

### 6.5 `App.jsx`

- Adicionar case `'calendario'` no `renderContent()`
- Renderiza `<CalendarView clients tasks team columns />`

### 6.6 `Sidebar.jsx`

- Adicionar item "📅 Calendário" com `setActiveTab('calendario')`

### 6.7 Aba Calendário dentro de Tarefas

Adicionar tab "📅 Calendário" nas views de Tarefas (ao lado de Kanban/Lista/Visão Geral/Arquivos):
- Renderiza `<CalendarView filterTypes={['task']} ... />`

---

## 7. Estratégia de Testes (Vitest)

### 7.1 `useCalendarEvents` — testes unitários

Mockar os 4 hooks de dados e verificar:

1. Task com `due_date` → evento azul na data correta
2. Task com `completed_at` → evento cinza
3. Task sem nenhum dos dois → não incluída
4. Activity com `scheduled_at` → evento roxo
5. Activity sem `scheduled_at` → não incluída
6. Receivable `pending` → evento amarelo (usa `due_date` se existir, senão `created_at`)
7. Receivable `invoiced` → não incluída
8. Transaction crédito → evento verde
9. Transaction débito → evento vermelho
10. Filtro `types: ['task']` → retorna apenas tasks

### 7.2 `financeUtils` — estender testes existentes

Adicionar caso: `shouldCreateReceivable` com receivable de origem `activity_id` (idempotência deve funcionar da mesma forma).

### 7.3 Integração cruzada — testes unitários

Para cada fluxo, mockar Supabase e verificar que o `related_to` correto é gravado:

- Activity → Transaction: `transactions.related_to` contém `{ type: 'activity', id }`
- Activity → Receivable: `receivables.activity_id` preenchido + `activities.related_to` atualizado
- Transaction → Task: `transactions.related_to` atualizado com `{ type: 'task', id }`
- Transaction → Activity: `activities.related_to` contém `{ type: 'transaction', id }`
- Receivable → Activity (follow-up): `activities.related_to` contém `{ type: 'receivable', id }`, `type === 'call'`
- Receivable → Task: task criada corretamente

---

## 8. Dependências a Instalar

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/core
```

Nenhuma outra dependência nova.

---

## 9. Ordem de Implementação Sugerida

1. **Migração DB** — `due_date` em tasks + mudanças em receivables
2. **Hook `useCalendarEvents`** + testes unitários
3. **`CalendarView` + `CalendarFilters`** — aba sidebar + view de Tarefas
4. **`EventDetailPanel`** — painel lateral com ações
5. **Campos `due_date`** em TaskModal e AddTaskModal
6. **ActivityForm** — accordion financeiro
7. **TransactionForm** — accordion vincular
8. **ReceivablesList** — botões Follow-up e Criar Tarefa
9. **Testes de integração cruzada**

---

## 10. Fora de Escopo (fase futura)

- Notificações/lembretes por WhatsApp ou Telegram
- Recorrência de eventos no calendário
- Arrastar eventos no calendário para reagendar (`editable: false` no FullCalendar)
- Exportação do calendário (iCal/Google Calendar)
