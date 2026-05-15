## PROMPT: Investigar por que o Kanban e outras visualizações não aparecem em "Minhas Tarefas" (NexusCRM)

### Contexto
O sistema exibe a área "Minhas Tarefas" (activeTab='tarefas') mas as visualizações — Kanban, Lista, Visão Geral, Arquivos, Calendário — não aparecem ou não carregam. O usuário vê uma tela vazia ou o loading nunca termina.

### Fluxo de renderização das tarefas

Em App.jsx (src/App.jsx), o case 'tarefas' (linha 582) renderiza:

```jsx
<TasksPage
  viewType={viewType}
  setViewType={setViewType}
  taskCount={filteredTasks.length}
  emptyState={{...}}
  content={(
    <div className="board-container">
      {viewType === 'kanban' && <KanbanView ... />}
      {viewType === 'list' && <ListView ... />}
      {viewType === 'overview' && <OverviewView ... />}
      {viewType === 'files' && ...}
      {viewType === 'calendar' && <Suspense><CalendarView ... /></Suspense>}
    </div>
  )}
/>
```

TasksPage (src/components/Tasks/TasksPage.jsx) renderiza o `content` em:
```jsx
<div className="tasks-page__content">
  {shouldRenderEmptyState ? <EmptyState ... /> : content}
</div>
```

Onde `shouldRenderEmptyState = Boolean(emptyState && taskCount === 0 && viewType !== 'calendar')`.

### Hipóteses a investigar (verificar todas)

#### 1. Nenhuma tarefa carregada (dados vazios do bootstrap)
- Verificar se `fetchWorkspaceBootstrap()` retorna tasks corretamente
- A função foi recentemente modificada para aceitar `options = {}` (com signal)
- Verificar se a Edge Function `/bootstrap` está retornando dados
- Verificar se `tasks` em App.jsx está vazio após o bootstrap
- Se tasks = [], filteredTasks = [], taskCount = 0, shouldRenderEmptyState = true

#### 2. Erro de runtime em KanbanView
- KanbanView (linha 343) usa @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- Verificar se esses pacotes estão instalados no node_modules
- Qualquer erro nesses imports causaria ViewErrorBoundary capturar e mostrar mensagem de erro
- Verificar se há erro no console (componentDidCatch loga)

#### 3. ViewErrorBoundary capturando erro
- O content é renderizado dentro de ViewErrorBoundary (App.jsx linha 869)
- ViewErrorBoundary usa getDerivedStateFromError
- Se algum componente filho lançar erro, hasError=true e mostra EmptyState de erro
- O erro pode ser silencioso se o usuário não olha o console

#### 4. Suspense nunca resolve
- CalendarView é o único com lazyWithRetry (linha 41 em App.jsx)
- Os outros (KanbanView, ListView, OverviewView) não são Suspense
- Mas o wrapper todo está em <Suspense fallback={<DeferredSurface .../>}> na linha 870
- Verificar se o Suspense está pendurado por algum lazy import quebrado

#### 5. CSS escondendo as views
- O KanbanView depende de classe `.board-container` (content wrapper)
- TaskCard usa classes como `.task-card`, `.kanban-column`
- CSS pode estar quebrado ou conflitando com algo novo

#### 6. viewType inválido
- viewType inicial em App.jsx linha 124: `useState('kanban')`
- PageTabs em TasksPage usa `TASK_VIEW_ITEMS` = ['kanban', 'list', 'overview', 'files', 'calendar']
- onChange={setViewType} passa o id do tab selecionado
- Se viewType for algo fora desses 5 valores, nenhum view condicional matching renderiza

### Arquivos para verificar

1. src/App.jsx — case 'tarefas', viewType state, emptyState prop, taskCount
2. src/components/Tasks/TasksPage.jsx — shouldRenderEmptyState logic, content rendering
3. src/components/Tasks/KanbanView.jsx — possible import/runtime errors
4. src/components/Tasks/ListView.jsx — possible rendering issues
5. src/components/Tasks/OverviewView.jsx — simple component, unlikely to fail
6. src/components/shared/ViewErrorBoundary.jsx — error catching path
7. src/components/shared/DeferredSurface.jsx — Suspense fallback
8. package.json — @dnd-kit dependencies

### Ações específicas

1. Verificar se @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities estão em package.json e node_modules
2. Verificar se KanbanView e ListView tem erros de sintaxe ou imports quebrados
3. Verificar o console.log ativo — rodar `npm run dev | grep -E "Error|error|Erro"` para detectar erros runtime
4. Verificar se tasks está vazio após bootstrap (entender se é problema de dados ou renderização)
5. Rodar `npm test` para verificar se testes de TasksPage/Kanban/List passam
6. Rodar `npm run lint` para verificar warnings nas views
7. Verificar o CSS (src/index.css) para a classe `.board-container` e `.kanban-column`

### Resultado esperado
Um relatório claro contendo:
- Causa raiz identificada (qual hipótese se confirmou)
- Arquivos e linhas afetados
- Correção aplicada (se aplicável)
- Risco residual
