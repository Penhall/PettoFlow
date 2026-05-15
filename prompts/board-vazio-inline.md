## PROMPT: Mostrar board vazio + EmptyState inline em TasksPage (NexusCRM)

### Problema
Atualmente TasksPage.jsx linha 61 faz:
```js
const shouldRenderEmptyState = Boolean(emptyState && taskCount === 0 && viewType !== 'calendar')
```

E no JSX (linha 187-195):
```jsx
<div className="tasks-page__content">
  {shouldRenderEmptyState ? (
    <EmptyState
      title={emptyState.title}
      description={emptyState.description}
      detail={emptyState.detail}
      quickActions={emptyState.quickActions}
      tutorialAction={emptyState.tutorialAction}
    />
  ) : content}
</div>
```

Isso SUBSTITUI completamente o board (KanbanView, ListView, OverviewView) pelo EmptyState quando não há tarefas. O usuário nunca vê o layout do board.

### Mudança desejada (Opção A)
O board (Kanban, Lista, etc.) deve SEMPRE renderizar, mesmo vazio. Quando não há tarefas, o EmptyState deve aparecer DENTRO da área do board (inline), não substituindo-o.

### Implementação

Arquivo: /root/PettoFlow/src/components/Tasks/TasksPage.jsx

**Linha 61** — manter `shouldRenderEmptyState` mas mudar o uso no JSX.

**Linhas 186-195** — substituir:
```jsx
      <div className="tasks-page__content">
        {shouldRenderEmptyState ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            detail={emptyState.detail}
            quickActions={emptyState.quickActions}
            tutorialAction={emptyState.tutorialAction}
          />
        ) : content}
      </div>
```

Por:
```jsx
      <div className="tasks-page__content">
        <div className={`board-wrapper ${shouldRenderEmptyState ? 'board-wrapper--empty' : ''}`}>
          {content}
          {shouldRenderEmptyState && emptyState && (
            <div className="board-empty-overlay">
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
                detail={emptyState.detail}
                quickActions={emptyState.quickActions}
                tutorialAction={emptyState.tutorialAction}
              />
            </div>
          )}
        </div>
      </div>
```

### CSS (index.css)
Adicionar no final do arquivo `/root/PettoFlow/src/index.css`:

```css
.board-wrapper {
  position: relative;
  min-height: 300px;
}

.board-wrapper--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.board-empty-overlay {
  width: 100%;
  max-width: 480px;
  margin-top: 24px;
}
```

### Regras
1. NÃO quebre testes existentes — execute `npm test` depois
2. NÃO mude nomes de funções, props, exports, ou interfaces
3. TasksPage NÃO importa SurfaceCard — NÃO adicione import
4. Mantenha o estilo (ES modules, 2-space indent, single quotes)
5. Execute `npm run lint` no final e corrija warnings
6. O EmptyState mostra quickActions (botão "Criar primeira tarefa") e tutorialAction — isso já funciona, só precisa aparecer junto com o board, não sozinho

### Pós-execução
- `npm test`
- `npm run lint`
- Verificar que KanbanView, ListView, OverviewView renderizam mesmo com tasks=[]
