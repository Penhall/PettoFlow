# Fase 13 - Conservative Legacy Cleanup

## Objetivo

Executar uma limpeza segura logo apos a integracao do shell premium, reduzindo legado sem correr risco desnecessario de quebrar areas antigas que ainda compartilham partes do `index.css`.

## O que foi feito

### 1. Componentes legacy do shell removidos

Os componentes antigos de montagem do shell foram removidos do repositÃ³rio:

- [Header.jsx](/E:/PROJETOS/PettoFlow/src/components/Header.jsx)
- [Sidebar.jsx](/E:/PROJETOS/PettoFlow/src/components/Sidebar.jsx)

Depois da integracao premium, o app principal passou a montar apenas:

- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)
- [ProfileMenu.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/ProfileMenu.jsx)

### 2. Acoplamento principal revisado

Foi validado que nao restaram imports do shell antigo no codigo ativo.

Checagem executada:

- `rg -n "components/Header|components/Sidebar|<Header|<Sidebar|from './components/Header'|from './components/Sidebar'" src`

Resultado:

- nenhuma referencia restante a `Header` ou `Sidebar` antigos

### 3. CSS legado reduzido no miolo principal

[index.css](/E:/PROJETOS/PettoFlow/src/index.css) teve uma poda inicial no bloco central do shell antigo, removendo a base estrutural principal de:

- `.sidebar`
- `.content`
- `.top-header`
- `.header-left`
- `.header-right`
- `.search-bar`

Essa limpeza foi deliberadamente conservadora:

- o que ainda e compartilhado por `Billing`, `Admin`, modais e outras areas antigas foi preservado
- utilitarios como `.icon-btn` e `.export-btn` continuam ativos

## O que nao foi prometido como concluido

Esta fase **nao** encerra toda a limpeza de legado visual.

Ainda restam no `index.css`:

- regras antigas espalhadas por breakpoints
- seletores herdados fora do shell principal
- classes antigas que podem continuar atreladas a modais, paines laterais e views nao migradas

Em outras palavras:

- o shell antigo saiu do runtime
- a limpeza total do CSS morto ainda demanda uma passada propria

## Arquivos principais

- [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx)
- [index.css](/E:/PROJETOS/PettoFlow/src/index.css)
- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)

## Resultado dos comandos

Validacoes executadas nesta fase:

- `rg -n "components/Header|components/Sidebar|<Header|<Sidebar|from './components/Header'|from './components/Sidebar'" src`
- `npx.cmd eslint src/App.jsx src/components/Activities/TemplatesTab.jsx src/components/shell/AppShell.jsx src/components/shell/SidebarRail.jsx src/components/shell/Topbar.jsx`
- `npm.cmd run build`

Resultado:

- imports legacy removidos do app ativo
- lint passou
- build passou

## Estado ao final da fase

O NexusCRM passou de:

- shell premium integrado, mas com componentes legacy ainda presentes no repositÃ³rio

para:

- shell premium como unica montagem ativa no runtime
- componentes legacy removidos do codigo
- limpeza de legado feita de forma segura, sem afirmar poda completa de CSS morto

## Proximo passo recomendado

Executar uma fase dedicada de **catalogacao e poda de CSS morto fora do shell**, com foco em:

1. breakpoints antigos nao mais usados
2. classes herdadas de views anteriores a Fase 10
3. utilitarios duplicados que hoje conflitam com as primitives premium
