## PROMPT: Investigar Kanban/visualizações em "Minhas Tarefas"

Investigue por que Kanban e outras visualizações (Lista, Visão Geral) não aparecem na aba "Tarefas" do NexusCRM.

### Passos:

1. Leia src/App.jsx, especificamente o case 'tarefas' (linhas ~582-686)
2. Leia src/components/Tasks/TasksPage.jsx (todo o arquivo)
3. Leia as primeiras 20 linhas de KanbanView.jsx, ListView.jsx, OverviewView.jsx
4. Execute `ls node_modules | grep dnd` no diretório do projeto
5. Execute `npm ls @dnd-kit/core 2>/dev/null` no diretório do projeto
6. Execute `node -e "try { require('@dnd-kit/core'); console.log('OK'); } catch(e) { console.log('FAIL:', e.message); }"` no diretório do projeto
7. Execute `node -e "try { require('./src/components/Tasks/KanbanView.jsx'); } catch(e) { console.log('FAIL:', e.message); }"` 2>/dev/null || echo "Cannot require JSX directly, OK"
8. Grep no index.css por .board-container e .tasks-page__content para ver se as classes CSS existem
9. Rodar `npm test -- --reporter=verbose 2>&1 | tail -40`
10. Rodar `npm run lint 2>&1 | tail -20`

### O que reportar:
- Os pacotes @dnd-kit estão instalados? Se não, essa é a causa raiz.
- TasksPage renderiza content ou emptyState? Se taskCount é 0, mostra EmptyState.
- Há erro de lint nos componentes de visualização?
- Os testes de TasksPage/Kanban passam?
- As classes CSS existem no index.css?

Responda APENAS com um relatório curto (5-10 linhas) identificando a causa raiz ou dizendo que não encontrou nada óbvio.
