# Calendar View para Atividades e Finanças — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o tab "📅 Calendário" às áreas Atividades e Finanças, seguindo o mesmo padrão do tab já existente em Minhas Tarefas.

**Architecture:** Dois novos props opcionais em `CalendarView` (`onEmptyDateClick`, `contextArea`) controlam comportamento por contexto. `EventDetailPanel` recebe `contextArea` e suprime ações irrelevantes no contexto financeiro. Cada área de destino adiciona um tab que chama `CalendarView` com os props corretos.

**Tech Stack:** React (JSX), FullCalendar 6, Framer Motion, Vitest + @testing-library/react

---

## Mapa de arquivos

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/components/Calendar/EventDetailPanel.jsx` | Modify | +prop `contextArea`, supressão condicional de botões |
| `src/components/Calendar/CalendarView.jsx` | Modify | +2 props: `onEmptyDateClick`, `contextArea` |
| `src/components/Finance/TransactionForm.jsx` | Modify | +prop `initialDate` para pré-preencher data em nova transação |
| `src/components/Activities/ActivitiesView.jsx` | Modify | +tab "📅 Calendário" |
| `src/components/Finance/FinanceView.jsx` | Modify | +tab "📅 Calendário" |
| `src/hooks/useCalendarEvents.test.js` | Modify | +testes de `contextArea` via EventDetailPanel render |

---

## Task 1: `EventDetailPanel` — prop `contextArea` com supressão de ações

**Files:**
- Modify: `src/components/Calendar/EventDetailPanel.jsx`
- Test: `src/hooks/useCalendarEvents.test.js` *(adicionar suite para EventDetailPanel)*

> **Contexto:** `EventDetailPanel` hoje renderiza botões JSX em blocos condicionais por `type` (task/activity/receivable/transaction). Não há string identifiers — a supressão é feita adicionando `contextArea !== 'financas'` diretamente nos botões que não fazem sentido no contexto financeiro.
>
> Botões a suprimir em `contextArea="financas"`:
> - No bloco `receivable`: "Follow-up" (linha ~146) e "Criar Tarefa" (linha ~158)
> - No bloco `transaction`: "Criar Tarefa" (linha ~170) e "Criar Atividade" (linha ~176)

- [ ] **Step 1: Criar arquivo de teste para EventDetailPanel**

Crie `src/components/Calendar/EventDetailPanel.test.jsx`:

```jsx
// src/components/Calendar/EventDetailPanel.test.jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EventDetailPanel from './EventDetailPanel'

// Framer Motion faz side effects com DOM — mockar para testes unitários
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}))

const makeEvent = (type, payload = {}) => ({
  id: `${type}-1`,
  title: 'Teste',
  date: '2026-03-26',
  type,
  color: '#000',
  sourceId: 1,
  sourceType: type,
  payload: { id: 1, amount: 10000, ...payload },
})

describe('EventDetailPanel — contextArea', () => {
  it('mostra Follow-up e Criar Tarefa em receivable sem contextArea', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
  })

  it('oculta Follow-up e Criar Tarefa em receivable com contextArea="financas"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
        contextArea="financas"
      />
    )
    expect(screen.queryByText('Follow-up')).not.toBeInTheDocument()
    expect(screen.queryByText('Criar Tarefa')).not.toBeInTheDocument()
    // Faturar deve continuar visível
    expect(screen.getByText('Faturar')).toBeInTheDocument()
  })

  it('oculta Criar Tarefa e Criar Atividade em transaction com contextArea="financas"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('transaction')}
        onClose={vi.fn()}
        contextArea="financas"
      />
    )
    expect(screen.queryByText('Criar Tarefa')).not.toBeInTheDocument()
    expect(screen.queryByText('Criar Atividade')).not.toBeInTheDocument()
  })

  it('mantém todas as ações em transaction sem contextArea', () => {
    render(
      <EventDetailPanel
        event={makeEvent('transaction')}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
    expect(screen.getByText('Criar Atividade')).toBeInTheDocument()
  })

  it('não suprime nada em contextArea="atividades"', () => {
    render(
      <EventDetailPanel
        event={makeEvent('receivable')}
        onClose={vi.fn()}
        contextArea="atividades"
      />
    )
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
    expect(screen.getByText('Criar Tarefa')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run src/components/Calendar/EventDetailPanel.test.jsx
```

Esperado: falha com `TypeError: contextArea is not a prop` ou botões aparecem quando não deveriam.

- [ ] **Step 3: Implementar `contextArea` em `EventDetailPanel`**

No arquivo `src/components/Calendar/EventDetailPanel.jsx`, adicionar `contextArea` à desestruturação de props (linha 23):

```jsx
export default function EventDetailPanel({
  event,
  onClose,
  clients = [],
  tasks = [],
  team = [],
  columns = [],
  onUpdateTask,
  onUpdateActivity,
  onInvoice,
  onAddActivity,
  onAddTask,
  createReceivableFromActivity,
  principalAccountId,
  contextArea,          // ← novo: 'global' | 'tarefas' | 'atividades' | 'financas' | undefined
}) {
```

No bloco `{/* RECEIVABLE actions */}` (em torno da linha 141), envolver os botões Follow-up e Criar Tarefa com condicionais:

```jsx
{/* RECEIVABLE actions */}
{type === 'receivable' && (
  <>
    <button className="action-btn" onClick={() => setInnerModal('invoice')}>
      <DollarSign size={14} /> Faturar
    </button>
    {contextArea !== 'financas' && (
      <button className="action-btn" onClick={() => {
        onAddActivity?.({
          title: `Follow-up: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`,
          type: 'call',
          status: 'pending',
          scheduled_at: null,
          related_to: [{ type: 'receivable', id: payload.id }],
        })
        onClose()
      }}>
        <Phone size={14} /> Follow-up
      </button>
    )}
    {contextArea !== 'financas' && (
      <button className="action-btn" onClick={() => {
        setNewTaskTitle(`Cobrar: ${payload.tasks?.title ?? payload.activities?.title ?? ''}`)
        setInnerModal('newTask')
      }}>
        <Plus size={14} /> Criar Tarefa
      </button>
    )}
  </>
)}
```

No bloco `{/* TRANSACTION actions */}` (em torno da linha 168), envolver ambos os botões:

```jsx
{/* TRANSACTION actions */}
{type === 'transaction' && (
  <>
    {contextArea !== 'financas' && (
      <button className="action-btn" onClick={() => {
        setNewTaskTitle('')
        setInnerModal('newTask')
      }}>
        <Plus size={14} /> Criar Tarefa
      </button>
    )}
    {contextArea !== 'financas' && (
      <button className="action-btn" onClick={() => {
        onAddActivity?.({
          title: payload.notes || 'Atividade vinculada',
          type: 'note',
          status: 'pending',
          scheduled_at: null,
          related_to: [{ type: 'transaction', id: payload.id }],
        })
        onClose()
      }}>
        <Plus size={14} /> Criar Atividade
      </button>
    )}
  </>
)}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run src/components/Calendar/EventDetailPanel.test.jsx
```

Esperado: 5 testes passando, 0 falhas.

- [ ] **Step 5: Commit**

```bash
cd E:/PROJETOS/PettoFlow && git add src/components/Calendar/EventDetailPanel.jsx src/components/Calendar/EventDetailPanel.test.jsx && git commit -m "feat: add contextArea prop to EventDetailPanel — suppress cross-module actions in finance context"
```

---

## Task 2: `CalendarView` — props `onEmptyDateClick` e `contextArea`

**Files:**
- Modify: `src/components/Calendar/CalendarView.jsx`

> **Contexto:** Hoje `CalendarView` (linha 82) tem `dateClick={({ dateStr }) => setDateClickDate(dateStr)}` que sempre abre `ActivityForm`. Precisamos permitir que o chamador injete um handler diferente via `onEmptyDateClick`. O prop `contextArea` é só passado adiante para `EventDetailPanel`.
>
> Não há teste automatizado para o clique em data — o FullCalendar é difícil de unit-testar. O comportamento será verificado manualmente no smoke test da Task 5.

- [ ] **Step 1: Adicionar os 2 novos props a `CalendarView`**

Em `src/components/Calendar/CalendarView.jsx`, atualizar a desestruturação de props (linha 23) e a lógica de `dateClick`:

```jsx
export default function CalendarView({
  filterTypes,
  tasks = [],
  clients = [],
  team = [],
  columns = [],
  onUpdateTask,
  onAddTask,
  onEmptyDateClick,   // ← novo: (dateStr: string) => void — substitui o padrão (ActivityForm)
  contextArea,        // ← novo: passado para EventDetailPanel
}) {
```

Substituir a linha `dateClick={({ dateStr }) => setDateClickDate(dateStr)}` (linha ~82) por:

```jsx
dateClick={({ dateStr }) => {
  if (onEmptyDateClick) {
    onEmptyDateClick(dateStr)
  } else {
    setDateClickDate(dateStr)
  }
}}
```

Passar `contextArea` para `EventDetailPanel` (linha ~90):

```jsx
<EventDetailPanel
  event={selectedEvent}
  onClose={() => setSelectedEvent(null)}
  clients={clients}
  tasks={tasks}
  team={team}
  columns={columns}
  onUpdateTask={onUpdateTask}
  onUpdateActivity={updateActivity}
  onInvoice={(id, amount, date) => invoiceReceivable(id, amount, date, addTransaction)}
  onAddActivity={addActivity}
  onAddTask={onAddTask}
  createReceivableFromActivity={createReceivableFromActivity}
  principalAccountId={principalAccount?.id ?? null}
  contextArea={contextArea}    // ← novo
/>
```

- [ ] **Step 2: Confirmar que nenhum teste quebrou**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run
```

Esperado: todos os testes passando (EventDetailPanel.test.jsx + useCalendarEvents.test.js + financeUtils.test.js + crossIntegration.test.js).

- [ ] **Step 3: Commit**

```bash
cd E:/PROJETOS/PettoFlow && git add src/components/Calendar/CalendarView.jsx && git commit -m "feat: add onEmptyDateClick and contextArea props to CalendarView"
```

---

## Task 3: `TransactionForm` — prop `initialDate`

**Files:**
- Modify: `src/components/Finance/TransactionForm.jsx`

> **Contexto:** `TransactionForm` usa o prop `transaction` para pré-preencher campos ao editar. Passar `transaction={{ date: dateStr }}` sem `id` confundiria a lógica (o título ficaria "Editar Transação"). O correto é adicionar um prop separado `initialDate` que pré-preenche só a data em uma nova transação.
>
> A lógica atual (linhas 45-65): se `transaction` é truthy, inicializa formulário com os campos do objeto. O `initialDate` age apenas quando `transaction` é null.

- [ ] **Step 1: Ler o início do TransactionForm para localizar o `useEffect` de inicialização**

```bash
# Só para confirmar a linha exata do useEffect — leia o arquivo antes de editar
```

Abra `src/components/Finance/TransactionForm.jsx` e localize o `useEffect` que inicializa o formulário (deve estar em torno da linha 40-65).

- [ ] **Step 2: Adicionar `initialDate` à desestruturação de props e ao `useEffect`**

Na desestruturação de props (início da função do componente), adicionar `initialDate`:

```jsx
export default function TransactionForm({
  transaction,
  initialDate,          // ← novo: string 'YYYY-MM-DD' — pré-preenche data para nova transação
  accounts = [],
  payees = [],
  groups = [],
  categories = [],
  clients = [],
  tasks = [],
  team = [],
  onSave,
  onClose,
  addPayee,
  addActivity,
  onCreateTask,
  onUpdateTransaction,
}) {
```

No `useEffect` de inicialização, no bloco `else` (quando `transaction` é null), usar `initialDate` se disponível:

```jsx
// Localizar a linha que faz:  date: today()
// Substituir por:
date: initialDate || today(),
```

O `useEffect` completo no bloco `else` ficará assim (preservando todos os outros campos como estão):

```jsx
} else {
  setForm({
    account_id:  accounts[0]?.id || '',
    amount:      0,
    date:        initialDate || today(),   // ← mudança aqui
    payee_id:    null,
    category_id: null,
    notes:       '',
    related_to:  [],
    cleared:     false,
  })
  setAmountInput('')
  setPayeeSearch('')
}
```

- [ ] **Step 3: Confirmar que os testes passam**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run
```

Esperado: todos os testes passando sem regressões.

- [ ] **Step 4: Commit**

```bash
cd E:/PROJETOS/PettoFlow && git add src/components/Finance/TransactionForm.jsx && git commit -m "feat: add initialDate prop to TransactionForm for calendar date-click pre-fill"
```

---

## Task 4: `ActivitiesView` — tab "📅 Calendário"

**Files:**
- Modify: `src/components/Activities/ActivitiesView.jsx`

> **Contexto:** `ActivitiesView` gerencia seus próprios dados via hooks (linhas 19-24). `CalendarView` tem seus próprios hooks internos — não há conflito. O tab de calendário em Atividades usa `filterTypes={['activity']}` e não precisa de `onEmptyDateClick` (o padrão já abre `ActivityForm`, que é o comportamento correto para este contexto).
>
> `clients`, `tasks` e `team` já chegam como props em `ActivitiesView` (linha 18) e precisam ser repassados para `CalendarView` (que os usa em `EventDetailPanel`).

- [ ] **Step 1: Adicionar import do CalendarView**

No topo de `src/components/Activities/ActivitiesView.jsx`, após os imports existentes (linha ~14):

```jsx
import CalendarView from '../Calendar/CalendarView'
```

- [ ] **Step 2: Adicionar o tab "📅 Calendário" na lista de tabs**

Localizar o bloco `<div className="tabs" ...>` (linhas ~133-146) e adicionar o botão do novo tab após "Modelos":

```jsx
<div className="tabs" style={{ marginBottom: '1rem' }}>
  <button
    className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
    onClick={() => setActiveTab('timeline')}
  >
    Timeline
  </button>
  <button
    className={`tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
    onClick={() => setActiveTab('modelos')}
  >
    Modelos
  </button>
  <button
    className={`tab-btn ${activeTab === 'calendario' ? 'active' : ''}`}
    onClick={() => setActiveTab('calendario')}
  >
    📅 Calendário
  </button>
</div>
```

- [ ] **Step 3: Adicionar o conteúdo do tab Calendário no `board-container`**

Localizar o bloco `<div className="board-container">` (linhas ~148-167) e adicionar após o bloco `{activeTab === 'modelos' && ...}`:

```jsx
{activeTab === 'calendario' && (
  <CalendarView
    filterTypes={['activity']}
    contextArea="atividades"
    clients={clients}
    tasks={tasks}
    team={team}
  />
)}
```

- [ ] **Step 4: Confirmar que os testes passam**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
cd E:/PROJETOS/PettoFlow && git add src/components/Activities/ActivitiesView.jsx && git commit -m "feat: add Calendário tab to ActivitiesView with filterTypes=['activity']"
```

---

## Task 5: `FinanceView` — tab "📅 Calendário"

**Files:**
- Modify: `src/components/Finance/FinanceView.jsx`

> **Contexto:** `FinanceView` já tem `showTransactionForm` / `editingTransaction` / `setShowTransactionForm` / `setEditingTransaction` em uso (linhas 23-24). Para o clique em data vazia no calendário, precisamos de um estado extra `calendarClickDate` para pré-preencher o `initialDate` do `TransactionForm` sem interferir com o fluxo de edição existente.
>
> `CalendarView` precisa dos props `clients`, `tasks`, `team`, `columns` e `onAddTask` — todos já disponíveis em `FinanceView` como props.
>
> O `tabs` array (linha 92) e o `TAB_LABELS` (linha 93) controlam a renderização dos botões de tab. Adicionar `'calendario'` a ambos.

- [ ] **Step 1: Adicionar import do CalendarView**

No topo de `src/components/Finance/FinanceView.jsx`, após os imports existentes (linha ~18):

```jsx
import CalendarView from '../Calendar/CalendarView'
```

- [ ] **Step 2: Adicionar o estado `calendarClickDate`**

Logo após as declarações de estado existentes (linha ~28), adicionar:

```jsx
const [calendarClickDate, setCalendarClickDate] = useState(null)
```

- [ ] **Step 3: Adicionar `'calendario'` ao array `tabs` e ao `TAB_LABELS`**

Localizar as linhas 92-93:

```jsx
const tabs = ['extrato', 'contas', 'regras', 'receber']
const TAB_LABELS = { extrato: 'Extrato', contas: 'Contas', regras: 'Regras', receber: 'A Receber' }
```

Substituir por:

```jsx
const tabs = ['extrato', 'contas', 'regras', 'receber', 'calendario']
const TAB_LABELS = { extrato: 'Extrato', contas: 'Contas', regras: 'Regras', receber: 'A Receber', calendario: '📅 Calendário' }
```

- [ ] **Step 4: Adicionar o conteúdo do tab Calendário no `board-container`**

Localizar o bloco `{/* TAB: A Receber */}` (em torno da linha 272) e adicionar após ele:

```jsx
{/* TAB: Calendário */}
{activeTab === 'calendario' && (
  <CalendarView
    filterTypes={['receivable', 'transaction']}
    contextArea="financas"
    clients={clients}
    tasks={tasks}
    team={team}
    columns={columns}
    onAddTask={onAddTask}
    onEmptyDateClick={(dateStr) => {
      setEditingTransaction(null)
      setCalendarClickDate(dateStr)
      setShowTransactionForm(true)
    }}
  />
)}
```

- [ ] **Step 5: Passar `initialDate` ao `TransactionForm`**

Localizar o `<TransactionForm ...>` no bloco de modais (em torno da linha 293). Adicionar o prop `initialDate`:

```jsx
<TransactionForm
  transaction={editingTransaction}
  initialDate={editingTransaction ? undefined : calendarClickDate}
  accounts={accounts}
  payees={payees}
  groups={groups}
  categories={categories}
  clients={clients}
  tasks={tasks}
  team={team}
  onSave={handleSaveTransaction}
  onClose={() => {
    setShowTransactionForm(false)
    setEditingTransaction(null)
    setCalendarClickDate(null)
  }}
  addPayee={addPayee}
  addActivity={addActivity}
  onCreateTask={onAddTask}
  onUpdateTransaction={updateTransaction}
/>
```

> **Nota:** `calendarClickDate` também deve ser limpo no `onClose`. A linha `setCalendarClickDate(null)` foi adicionada ao handler de close acima.

- [ ] **Step 6: Confirmar que os testes passam**

```bash
cd E:/PROJETOS/PettoFlow && npx vitest run
```

Esperado: todos os testes passando, 0 regressões.

- [ ] **Step 7: Smoke test manual**

1. Iniciar o servidor de dev: `npm run dev`
2. Navegar para **Atividades** → verificar tab "📅 Calendário"
   - Eventos roxos de atividades com `scheduled_at` aparecem no calendário
   - Clicar em data vazia → `ActivityForm` abre com data pré-preenchida
   - Clicar em um evento de atividade → `EventDetailPanel` mostra: Editar, Criar Transação, Criar A Receber, Concluir
3. Navegar para **Finanças** → verificar tab "📅 Calendário"
   - Eventos amarelos (receivables) e verdes/vermelhos (transactions) aparecem
   - Clicar em data vazia → `TransactionForm` abre com data pré-preenchida
   - Clicar em evento receivable → painel mostra apenas "Faturar" (sem Follow-up, sem Criar Tarefa)
   - Clicar em evento transaction → painel mostra nenhuma ação (bloco transaction vazio em contextArea=financas)
4. Verificar que os tabs globais **Calendário** e **Minhas Tarefas → Calendário** continuam funcionando identicamente (sem regressão)

- [ ] **Step 8: Commit final**

```bash
cd E:/PROJETOS/PettoFlow && git add src/components/Finance/FinanceView.jsx && git commit -m "feat: add Calendário tab to FinanceView with receivable and transaction events"
```

---

## Checklist de cobertura do spec

| Requisito do spec | Task |
|-------------------|------|
| `CalendarView` aceita `onEmptyDateClick` | Task 2 |
| `CalendarView` aceita `contextArea` e repassa para `EventDetailPanel` | Task 2 |
| `EventDetailPanel` suprime Follow-up e Criar Tarefa em receivable com contextArea=financas | Task 1 |
| `EventDetailPanel` suprime Criar Tarefa e Criar Atividade em transaction com contextArea=financas | Task 1 |
| Tab Calendário em Atividades com filterTypes=['activity'] | Task 4 |
| Clique em data vazia em Atividades → ActivityForm | Task 4 (comportamento padrão) |
| Tab Calendário em Finanças com filterTypes=['receivable','transaction'] | Task 5 |
| Clique em data vazia em Finanças → TransactionForm com data pré-preenchida | Tasks 3 + 5 |
| Zero novos arquivos (exceto test) | ✓ |
| Zero mudanças em banco/hooks | ✓ |
| Comportamento existente preservado (contextArea opcional) | Task 1 + 2 |
