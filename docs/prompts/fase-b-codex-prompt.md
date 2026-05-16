# Fase B — Feature Flags Wiring + Seed Data

## Contexto

Projeto: NexusCRM/PettoFlow (SaaS de CRM para SMBs)
Stack: React + Vite + Supabase + FullCalendar
Testes: Vitest (`npm test`), lint (`npm run lint`), build (`npm run build`)

## Arquitetura

TasksPage (src/components/Tasks/TasksPage.jsx) é um container **presentation-only**. Recebe `viewType`, `content` (JSX já renderizado), callbacks etc. como props de App.jsx. Os renders filhos (KanbanView, ListView, OverviewView, CalendarView) são passados via `content`.

CalendarView está em src/components/Calendar/CalendarView.jsx, usado em App.jsx linha 937-949.

## Tarefa M-01: Wire 3 Feature Flags

### 1. src/lib/featureFlags.js

Adicionar ao objeto `DEFAULT_FLAGS`:

```js
// Feature visibility (Fase B)
guided_tour_enabled: true,       // auto-prompt onboarding tour on dashboard
batch_operations: true,          // batch select/update/delete tasks
calendar_view: true,             // calendar tab in tasks view
```

### 2. src/App.jsx — Wire `guided_tour_enabled`

O hook `useOnboarding` já existe (linha 126). O useEffect de auto-tour (linhas 446-467) dispara automaticamente ao entrar no dashboard. Envolver o início do efeito com:

```js
if (!isEnabled('guided_tour_enabled')) return
```

Já existe `import { isEnabled } from './lib/featureFlags.js'` na linha 28.

### 3. src/components/Tasks/TasksPage.jsx — Wire `calendar_view`

TasksPage tem `TASK_VIEW_ITEMS` (linhas 8-14) com 5 itens. Modificar para filtrar condicionalmente.

Importar `isEnabled` no topo com `import { isEnabled } from '../../lib/featureFlags.js'`.

No corpo do componente, usar `useMemo` para gerar os items filtrados:

```js
const taskViewItems = useMemo(() => {
  const items = [
    { id: 'kanban', label: 'Kanban' },
    { id: 'list', label: 'Lista' },
    { id: 'overview', label: 'Visão geral' },
    { id: 'files', label: 'Arquivos' },
    { id: 'calendar', label: 'Calendário' },
  ]
  if (!isEnabled('calendar_view')) {
    return items.filter(item => item.id !== 'calendar')
  }
  return items
}, [])
```

Substituir `TASK_VIEW_ITEMS` por `taskViewItems` no JSX (linha 72).

Mover a constante `TASK_VIEW_ITEMS` para dentro do componente ou removê-la.

### 4. src/components/Tasks/TasksPage.jsx + App.jsx — Wire `batch_operations`

#### 4a. BatchActionBar (src/components/Tasks/BatchActionBar.jsx)

Criar componente novo:

```jsx
export default function BatchActionBar({
  selectedCount,
  columns,
  teamMembers,
  onMoveToColumn,
  onAssign,
  onDelete,
  onClearSelection,
}) {
  // Renderiza uma barra fixa no topo com:
  // - Texto: "N tarefas selecionadas"
  // - Dropdown "Mover para coluna" (lista columns)
  // - Dropdown "Atribuir para" (lista teamMembers)
  // - Botão "Excluir" (destrutivo, vermelho)
  // - Botão "Limpar seleção"
  // Estilo: barra horizontal cinza claro com padding, borda inferior
}
```

Usar classes CSS no estilo BEM (`.batch-action-bar`, `.batch-action-bar__button`, etc.). O objetivo é funcional, não visualmente refinado.

#### 4b. TasksPage — adicionar suporte a batch

TasksPage recebe novas props:
- `selectedTaskIds: Set<string>` (ou array)
- `onSelectionChange: (ids: Set<string>) => void`
- `onBatchMoveToColumn: (columnId: string) => void`
- `onBatchAssign: (memberId: string) => void`
- `onBatchDelete: () => void`
- `columns: array` (para o dropdown)
- `teamMembers: array` (para o dropdown)

Renderizar `BatchActionBar` **acima do PageActionBar** (ou no lugar) quando:
- `selectedTaskIds.size > 0` E `isEnabled('batch_operations')`

Também adicionar prop `batchMode: boolean` que controla se checkboxes são exibidos na lista.

#### 4c. App.jsx — integrar batch no case 'tarefas'

Adicionar estado: `const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())`

Passar para TasksPage:
- `selectedTaskIds`
- `onSelectionChange={setSelectedTaskIds}`
- `onBatchMoveToColumn={(columnId) => { selectedTaskIds.forEach(id => updateTask(id, { columnId })); setSelectedTaskIds(new Set()) }}`
- `onBatchAssign={(memberId) => { selectedTaskIds.forEach(id => updateTask(id, { assignedTo: memberId })); setSelectedTaskIds(new Set()) }}`
- `onBatchDelete={() => { selectedTaskIds.forEach(id => deleteTask(id)); setSelectedTaskIds(new Set()) }}`
- `columns={columns}`
- `teamMembers={team}`
- `batchMode={selectedTaskIds.size > 0}`

#### 4d. ListView — adicionar checkboxes

Se `batchMode` for true, cada linha da lista renderiza um checkbox. Clicar no checkbox adiciona/remove o ID do task no Set.

Se TasksPage passar `selectedTaskIds` e `onSelectionChange` para ListView de alguma forma, ou se o ListView receber props diretamente.

**Simplificação:** passar `selectedTaskIds` e `onSelectionChange` como parte do `content` não é trivial porque `content` é JSX já montado. Em vez disso:

1. TasksPage renderiza `ListView` **fora** do `content` quando `viewType === 'list'` e `batchMode` está ativo
2. Ou: `content` (JSX) é construído pela App.jsx, então a App.jsx controla as props do ListView

**Solução mais prática:** manter tudo em TasksPage. TasksPage já recebe `content` como JSX. Para batch na list view:

1. Envolver o `content` com batch mode: adicionar um `cloneElement` ou renderizar um wrapper que intercepta cliques
2. **Melhor:** TasksPage recebe `onBatchModeChange` e `batchMode`, e quando batchMode está ativo, renderiza uma toolbar extra. A lógica de checkboxes fica no ListView (que recebe `selectedTaskIds` e `onSelectionChange` diretamente de App.jsx)

Na prática, modificar App.jsx para passar `selectedTaskIds` e `onSelectionChange` diretamente para ListView:

```jsx
{viewType === 'list' && (
  <ListView
    tasks={filteredTasks}
    columns={columns}
    onUpdateTask={updateTask}
    onDeleteTask={deleteTask}
    selectedTaskIds={selectedTaskIds}
    onSelectionChange={setSelectedTaskIds}
    batchMode={isEnabled('batch_operations')}
  />
)}
```

E TasksPage recebe `selectedTaskIds`, `onSelectionChange` como props para renderizar o BatchActionBar.

**IMPORTANTE:** Verificar se ListView é um componente simples. Se for, adicionar checkboxes nele. Caso contrário, adaptar a abordagem.

## Tarefa M-02: Seed Data

### 1. Criar `supabase/seed.sql`

Idempotente. Usar `on conflict do nothing` onde possível. Inserir dados para tenant slug = 'central', **criando o tenant se não existir**.

**Schema das tabelas:**

```sql
activities: id (uuid PK), tenant_id (FK), user_id, type (text), title (text), description (text),
  date (date), time (time), duration_minutes (int), status (text default 'scheduled'),
  created_at, updated_at

accounts: id (uuid PK), tenant_id (FK), name (text), type (text), is_active (boolean),
  created_at, updated_at

fin_categories: id (uuid PK), tenant_id (FK), group_id (uuid nullable), name (text),
  type (text default 'expense'), sort_order (int), created_at

transactions: id (uuid PK), tenant_id (FK), account_id (FK), category_id (FK nullable),
  payee_id (FK nullable), type (text: 'income'|'expense'|'transfer'), amount (numeric),
  date (date), description (text), created_at

tasks: id (uuid PK), tenant_id (FK), title (text), status (text: 'todo'|'in_progress'|'done'|'archived'),
  column_id (FK), assigned_to (FK nullable), client_id (FK nullable), priority (text),
  completed_at (timestamptz nullable), created_at, updated_at, tags (text[]), description (text)
```

**Dados:**

#### activities (5 registros):
1. Reunião de planejamento semanal, type=meeting, hoje às 10:00, 60min
2. Ligação para cliente ACME Corp, type=call, hoje às 14:00, 30min
3. Revisão de orçamento mensal, type=review, amanhã às 09:00, 45min
4. Alinhamento com equipe de design, type=meeting, amanhã às 15:00, 60min
5. Follow-up proposta comercial, type=call, depois de amanhã às 11:00, 30min

#### accounts (2 registros):
1. Conta Corrente Principal (type='checking', is_active=true)
2. Conta Poupança Reserva (type='savings', is_active=true)

#### fin_categories (5 registros sem group_id):
1. Serviços (sort_order=1, type='expense')
2. Material de Escritório (sort_order=2, type='expense')
3. Assinaturas (sort_order=3, type='expense')
4. Receita de Serviços (sort_order=10, type='revenue')
5. Receita de Produtos (sort_order=11, type='revenue')

#### transactions (4 registros):
1. Pagamento de assinatura mensal, type='expense', amount=299.00, category=Assinaturas, date=3 dias atrás
2. Compra de material escritório, type='expense', amount=157.50, category=Material de Escritório, date=2 dias atrás
3. Recebimento de serviço, type='income', amount=5000.00, category=Receita de Serviços, date=ontem
4. Transferência entre contas, type='transfer', amount=2000.00, no category, date=hoje

#### tasks (3 registros com status 'done' para aparecer em Arquivo):
1. "Implementar layout do dashboard" (status='done', priority='high', completed_at=5 dias atrás)
2. "Configurar integração com Telegram" (status='done', priority='medium', completed_at=3 dias atrás)
3. "Onboarding do usuário tester" (status='done', priority='high', completed_at=1 dia atrás)

Usar UUIDs fixos (gen_random_uuid()) — a idempotência vem de on conflict ou check de count().

### 2. Migration `supabase/migrations/20260516000000_seed_demo_data.sql`

Migration que insere seed data no tenant Central **se as tabelas estiverem vazias** para aquele tenant.

Usar `do $$ ... $$` block. Estrutura:

```sql
do $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
  v_col_id uuid; -- reference to first kanban column
begin
  -- Find Central tenant (case-insensitive)
  select id into v_tenant_id from public.tenants where lower(slug) = 'central';

  if v_tenant_id is null then
    raise notice 'Tenant "central" not found — skipping seed';
    return;
  end if;

  -- Find the tenant owner for user_id references
  select owner_user_id into v_user_id from public.tenants where id = v_tenant_id;

  if v_user_id is null then
    raise notice 'Tenant "central" has no owner — skipping seed';
    return;
  end if;

  -- Get a kanban column for task column_id
  select id into v_col_id from public.kanban_columns
    where tenant_id = v_tenant_id
    order by order_index limit 1;

  -- Seed activities (only if empty)
  if (select count(*) from public.activities where tenant_id = v_tenant_id) = 0 then
    insert into public.activities (tenant_id, user_id, type, title, description, date, time, duration_minutes, status)
    values ...;
  end if;

  -- Same pattern for accounts, fin_categories, transactions, tasks
end $$;
```

## Validação

```bash
npm run lint        # 0 warnings
npm test            # existing tests must pass
npm run build       # build succeeds
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/lib/featureFlags.js` | Modificar — adicionar 3 flags |
| `src/App.jsx` | Modificar — wire guided_tour_enabled + batch props |
| `src/components/Tasks/TasksPage.jsx` | Modificar — wire calendar_view + batch UI |
| `src/components/Tasks/BatchActionBar.jsx` | **Criar** — componente de barra de ações em lote |
| `src/components/Tasks/ListView.jsx` | Modificar — adicionar checkboxes (se existir) |
| `supabase/seed.sql` | **Criar** — seed data idempotente |
| `supabase/migrations/20260516000000_seed_demo_data.sql` | **Criar** — migration idempotente |
