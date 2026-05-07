# Fase 14 - CSS Dead Code Pruning

## Objetivo

Executar a primeira poda real de CSS morto fora do shell premium, agora que a montagem legacy saiu do runtime.

O foco desta fase foi:

- remover seletores antigos sem consumidor no `src`
- reduzir colisao entre classes legacy e primitives premium
- deixar o `index.css` mais coerente com o estado atual da interface

## O que foi removido

### 1. Blocos antigos de navegacao e taskbar

Foram removidos do [index.css](/E:/PROJETOS/PettoFlow/src/index.css) seletores do modelo antigo de navegacao horizontal e taskbar:

- `.taskbar`
- `.tabs`
- `.tab-btn`

Esses blocos eram remanescentes do layout anterior e ja nao tinham referencia no codigo ativo, que hoje usa:

- [PageTabs.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/PageTabs.jsx)
- [PageActionBar.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/PageActionBar.jsx)

### 2. Regras antigas de `finance-view`

Tambem sairam seletores ligados a uma estrutura de `Finance` anterior ao refactor premium:

- `.finance-view`
- `.finance-view .view-controls`
- `.finance-view .tabs`
- `.finance-view .tab-btn`

Hoje a pagina usa:

- [FinanceView.jsx](/E:/PROJETOS/PettoFlow/src/components/Finance/FinanceView.jsx)
- `finance-page`
- `PageTabs`
- `PageActionBar`
- `SurfaceCard`

### 3. Regras antigas de `view-controls`

Foram podadas regras de `view-controls` e derivados que nao possuem mais consumidor direto no app atual:

- `.view-controls`
- `.view-controls .actions`
- `.view-controls .actions .add-member-btn`

Esses seletores eram resquicios de composicao anterior ao sistema de primitives compartilhadas.

### 4. Residuos do header/sidebar antigo no CSS

A passada tambem removeu restos de CSS do shell legacy que ainda sobravam em breakpoints:

- `hamburger-btn`
- `sidebar-mobile-overlay`
- `collapse-btn`
- trechos antigos de `.sidebar`
- trechos antigos de `.content`
- trechos antigos de `top-header`, `header-left`, `header-right` e `search-bar`

## Resultado tecnico

O `rg` deixou de encontrar os seletores-alvo removidos em [index.css](/E:/PROJETOS/PettoFlow/src/index.css):

- `.taskbar`
- `.tabs`
- `.tab-btn`
- `.finance-view`
- `.view-controls`
- `top-header`
- `header-left`
- `header-right`
- `search-bar`
- `hamburger-btn`
- `sidebar-mobile-overlay`
- `collapse-btn`
- `.content`

## Escopo e cautela

Esta fase foi uma poda de legado **orientada por consumo real no `src`**.

O que foi preservado de proposito:

- `.icon-btn`
- `.action-btn`
- `.export-btn`
- `.sidebar-overlay`

Essas classes ainda servem a areas como:

- [RecordSidebar.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/RecordSidebar.jsx)
- [BillingPage.jsx](/E:/PROJETOS/PettoFlow/src/components/billing/BillingPage.jsx)
- [AdminPanel.jsx](/E:/PROJETOS/PettoFlow/src/admin/AdminPanel.jsx)

## Arquivos principais

- [index.css](/E:/PROJETOS/PettoFlow/src/index.css)
- [Header.jsx](/E:/PROJETOS/PettoFlow/src/components/Header.jsx)
- [Sidebar.jsx](/E:/PROJETOS/PettoFlow/src/components/Sidebar.jsx)

## Resultado dos comandos

Validacoes executadas nesta fase:

- `rg -n "\\.taskbar\\b|\\.tabs\\b|\\.tab-btn\\b|\\.finance-view\\b|\\.view-controls\\b|top-header|header-left|header-right|search-bar|hamburger-btn|sidebar-mobile-overlay|collapse-btn|\\.content\\b" src/index.css`
- `npx.cmd eslint src/App.jsx src/components/Activities/TemplatesTab.jsx src/components/shell/AppShell.jsx src/components/shell/SidebarRail.jsx src/components/shell/Topbar.jsx`
- `npm.cmd run build`

Resultado:

- os seletores-alvo deixaram de ser encontrados
- lint passou
- build passou

## Impacto observado

A poda reduziu fortemente o peso de legado concentrado em `index.css`.

Diff principal desta fase:

- [index.css](/E:/PROJETOS/PettoFlow/src/index.css): grande reducao de regras antigas
- [Header.jsx](/E:/PROJETOS/PettoFlow/src/components/Header.jsx): removido
- [Sidebar.jsx](/E:/PROJETOS/PettoFlow/src/components/Sidebar.jsx): removido

## Riscos remanescentes

- ainda existem estilos antigos fora do escopo desta poda, principalmente em areas menos tocadas do produto
- o `index.css` continua centralizando muitos modulos, entao uma futura etapa de modularizacao ainda faria sentido
- o bundle JS principal continua acima de 500 kB apos minificacao

## Estado ao final da fase

O NexusCRM passou de:

- shell premium ativo, mas com uma camada grande de CSS antigo ainda convivendo no arquivo global

para:

- shell premium sustentado por um `index.css` bem menos contaminado por seletores mortos
- menos conflito entre layout antigo e primitives premium
- base mais segura para continuar refatorando paginas legacy
