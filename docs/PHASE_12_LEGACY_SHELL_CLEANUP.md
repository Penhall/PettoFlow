# Fase 12 - Legacy Shell Cleanup

## Objetivo

Fechar a passada seguinte apos a integracao do shell premium:

- remover componentes antigos sem uso
- reduzir acoplamento ao shell legado
- deixar o repositÃ³rio mais coerente com o estado atual da UI

## O que entrou nesta fase

### 1. Remocao dos componentes legacy do shell

Os componentes antigos do shell deixaram de existir no `src/components`:

- [Header.jsx](/E:/PROJETOS/PettoFlow/src/components/Header.jsx)
- [Sidebar.jsx](/E:/PROJETOS/PettoFlow/src/components/Sidebar.jsx)

Eles ja nao eram mais usados apos a troca do app para:

- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)

### 2. Limpeza segura do acoplamento principal

[index.css](/E:/PROJETOS/PettoFlow/src/index.css) foi podado na parte central do shell antigo:

- blocos estruturais de `.sidebar`
- regras do header antigo (`.top-header`, `.header-left`, `.header-right`, `.search-bar`)
- bloco legado de `.content`

Foi mantido o que ainda e compartilhado por outras areas, em especial:

- `.icon-btn`
- `.export-btn`

Isso evita quebrar:

- [BillingPage.jsx](/E:/PROJETOS/PettoFlow/src/components/billing/BillingPage.jsx)
- [AdminPanel.jsx](/E:/PROJETOS/PettoFlow/src/admin/AdminPanel.jsx)

### 3. Consolidacao do estado atual do frontend

Depois da limpeza:

- o app nao referencia mais `Header` ou `Sidebar` antigos
- o shell premium virou a unica montagem ativa do produto
- a base de manutencao ficou mais simples para os proximos refactors de pagina

## Arquivos principais

- [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx)
- [index.css](/E:/PROJETOS/PettoFlow/src/index.css)
- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)

## Resultado dos comandos

Validacoes executadas para esta consolidacao:

- `rg -n "components/Header|components/Sidebar|<Header|<Sidebar|from './components/Header'|from './components/Sidebar'" src`
- `npx.cmd eslint src/App.jsx src/components/Activities/TemplatesTab.jsx src/components/shell/AppShell.jsx src/components/shell/SidebarRail.jsx src/components/shell/Topbar.jsx`
- `npm.cmd run build`

Resultado:

- nao restaram referencias de import aos componentes legacy
- lint passou
- build passou

## Riscos e limites remanescentes

- ainda sobraram seletores CSS antigos em areas nao ligadas diretamente ao shell, entao a limpeza total de legado nao terminou aqui
- a remocao foi propositalmente conservadora para nao quebrar classes compartilhadas por `Billing`, `Admin` e modais antigos
- ainda vale uma passada futura para catalogar CSS morto fora do shell

## Estado ao final da fase

O NexusCRM passou de:

- shell premium ativo, mas coexistindo com componentes legacy ainda presentes no repositÃ³rio

para:

- shell premium como unica montagem ativa
- componentes de shell antigo removidos
- base mais limpa para continuar a migracao visual e a poda de legado
