# Fase 15 - Legacy Page Migration

## Objetivo

Migrar as paginas legacy restantes do NexusCRM para o sistema premium de pagina, removendo o frame temporario em [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx) e alinhando:

- `Dashboard`
- `Time`
- `Clientes`
- `Calendario`

ao mesmo modelo usado nas areas ja modernizadas:

- `PageHeader`
- `PageActionBar`
- superficies contidas
- densidade operacional mais limpa

## O que entrou nesta fase

### 1. Remocao do wrapper legacy do app

[App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx) deixou de embrulhar `Dashboard`, `Time`, `Clientes` e `Calendario` com `renderLegacyPage`.

Resultado:

- o `App` volta a ser apenas coordenador de estado e shell
- cada pagina passa a carregar sua propria hierarquia visual
- a migracao premium deixa de depender de um header injetado de fora

### 2. Dashboard refeito como pagina premium

[Dashboard.jsx](/E:/PROJETOS/PettoFlow/src/components/Dashboard/Dashboard.jsx) foi reescrito para operar como superficie premium real.

Entraram:

- `PageHeader` com indicadores operacionais
- `PageActionBar` enxuta
- hero de leitura do ciclo atual
- grid de progresso por tarefa
- distribuicao de tags
- lista de tarefas recentes
- empty state proprio quando nao ha volume suficiente

O dashboard deixou de ser uma colecao de cards coloridos e passou a funcionar como leitura executiva mais calma e mais densa.

### 3. Time migrado para lista operacional premium

[TimeView.jsx](/E:/PROJETOS/PettoFlow/src/components/Team/TimeView.jsx) saiu do grid de cards legado e virou uma lista operacional mais compacta.

Mudancas principais:

- `PageHeader` e `PageActionBar` proprios
- metricas de membros, capacidade e tarefas alocadas
- linhas densas com identidade, capacidade, foco recente e acoes
- empty state contextual
- modal de membro preservado, mas reenquadrado no shell novo

### 4. Clientes migrado para carteira premium

[ClientesView.jsx](/E:/PROJETOS/PettoFlow/src/components/Clients/ClientesView.jsx) foi reorganizado como carteira operacional premium.

Entraram:

- `PageHeader` com contagem de clientes, industrias e tarefas relacionadas
- `PageActionBar` com CTA de criacao
- lista premium por conta, relacionamento, receita e projetos
- abertura explicita do perfil do cliente por acao contextual
- empty state contextualizado

### 5. Calendario ganhou shell premium dedicado

Foi criado [CalendarWorkspacePage.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarWorkspacePage.jsx) para encapsular a agenda global do workspace.

Isso permitiu:

- manter [CalendarView.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarView.jsx) reutilizavel nas areas embutidas
- dar ao calendario global seu proprio `PageHeader`
- mover os filtros de agenda para a camada premium da pagina
- separar a agenda unificada do uso embutido em `Tasks`

### 6. Filtros de calendario sairam de inline styling

[CalendarFilters.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarFilters.jsx) foi refeito para usar classes do sistema em vez de estilos inline.

Com isso:

- filtros passam a obedecer tokens de superficie e motion
- estados ativos ficam coerentes com o restante do produto
- o calendario deixa de carregar a ultima aparencia utilitaria herdada

## Arquivos principais

### Wiring global

- [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx)

### Paginas migradas

- [Dashboard.jsx](/E:/PROJETOS/PettoFlow/src/components/Dashboard/Dashboard.jsx)
- [TimeView.jsx](/E:/PROJETOS/PettoFlow/src/components/Team/TimeView.jsx)
- [ClientesView.jsx](/E:/PROJETOS/PettoFlow/src/components/Clients/ClientesView.jsx)
- [CalendarWorkspacePage.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarWorkspacePage.jsx)
- [CalendarView.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarView.jsx)
- [CalendarFilters.jsx](/E:/PROJETOS/PettoFlow/src/components/Calendar/CalendarFilters.jsx)

### Estilos

- [index.css](/E:/PROJETOS/PettoFlow/src/index.css)

## Resultado da fase

O NexusCRM passou de:

- shell premium integrado, mas ainda com `Dashboard`, `Time`, `Clientes` e `Calendario` apoiados em frame legacy

para:

- quatro paginas restantes operando no sistema premium real
- header e action bar proprietarios por pagina
- base pronta para refinar miolo, modais e paineis internos

## Limites remanescentes ao fim da fase

- `ClientProfileModal` e `EventDetailPanel` ainda precisavam de refino visual e estrutural
- os modais de `Time` e `Clientes` ainda dependiam de base utilitaria antiga
- faltava a passada de consistencia final de motion, foco e responsividade fina
