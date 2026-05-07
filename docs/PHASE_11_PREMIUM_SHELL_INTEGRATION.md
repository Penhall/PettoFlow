# Fase 11 - Premium Shell Integration

## Objetivo

Concluir a troca do shell global do NexusCRM para a arquitetura premium definida na Fase 10:

- integrar rail lateral, topbar curta e menu de perfil no app real
- ligar busca global ao fluxo correto por pagina
- manter densidade operacional nas paginas ja migradas
- criar uma base consistente para as superficies ainda legacy

## O que entrou nesta fase

### 1. Integracao real do shell premium no app

O app deixou de montar o shell antigo diretamente e passou a usar:

- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)
- [ProfileMenu.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/ProfileMenu.jsx)

Essa troca foi feita em [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx).

Resultado:

- shell novo ativo no fluxo principal
- sidebar com modo recolhido no desktop
- drawer lateral no mobile
- menu de perfil centralizando saida e tema
- botao administrativo preservado via `isPlatformAdmin`

### 2. Busca global reencaixada por contexto

O topo novo nao ficou apenas visual. A busca foi religada ao comportamento correto por area em [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx):

- `Time` e `Clientes` continuam com busca de conteudo da propria pagina
- areas premium e de navegacao geral passam a usar a command palette
- foco na busca do topo pode abrir a palette diretamente

Isso evita duplicacao entre topbar e `PageActionBar` e preserva a diferenca entre:

- busca operacional de lista
- navegacao global por entidade

### 3. Header padronizado para paginas ainda legacy

Nem todas as areas antigas tinham `PageHeader` proprio.

Para nao deixar partes do produto sem hierarquia ao remover o header legacy, [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx) passou a montar um frame padrao para:

- `Dashboard`
- `Time`
- `Clientes`
- `Calendario`

Esse frame usa:

- [PageHeader.jsx](/E:/PROJETOS/PettoFlow/src/components/shared/PageHeader.jsx)

E cria uma base visual intermediaria para as paginas que ainda nao migraram integralmente para `PageTabs` e `PageActionBar`.

### 4. Responsividade e consistencia do shell

[index.css](/E:/PROJETOS/PettoFlow/src/index.css) recebeu a passada estrutural que faltava para o shell premium funcionar bem:

- `app-shell` com coluna adaptavel para rail expandida/recolhida
- `app-shell__content` com scroll e padding reais
- topbar mobile com `wrap`, largura total e alvos de toque maiores
- controles compartilhados ajustados para melhor uso em touch
- filtro ativo em `Tasks` corrigido para o novo seletor de `PageActionBar`

### 5. Consistencia visual em Activities e Finance

Ainda nesta passada entraram ajustes de consistencia em superficies operacionais:

- [TemplatesTab.jsx](/E:/PROJETOS/PettoFlow/src/components/Activities/TemplatesTab.jsx) saiu de inline styles e passou a usar classes do sistema
- wrappers e estados de tabela de `Finance` foram mantidos coerentes com a nova estrutura do shell

## Arquivos principais

### Shell e wiring global

- [App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx)
- [AppShell.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/AppShell.jsx)
- [SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [Topbar.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/Topbar.jsx)
- [ProfileMenu.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/ProfileMenu.jsx)

### Consistencia visual

- [index.css](/E:/PROJETOS/PettoFlow/src/index.css)
- [TemplatesTab.jsx](/E:/PROJETOS/PettoFlow/src/components/Activities/TemplatesTab.jsx)

## Resultado dos comandos

Validacoes executadas nesta fase:

- `npx.cmd vitest run src/components/shell/AppShell.test.jsx src/components/tenant/TenantSwitcher.test.jsx src/components/Settings/SettingsView.test.jsx src/components/Finance/FinanceView.test.jsx src/components/Activities/ActivitiesView.test.jsx src/components/Tasks/TasksPage.test.jsx`
- `npx.cmd eslint src/App.jsx src/components/shell/AppShell.jsx src/components/shell/Topbar.jsx src/components/shell/SidebarRail.jsx src/components/Activities/TemplatesTab.jsx`
- `npm.cmd run build`

Resultado:

- 6 arquivos de teste passaram
- 8 testes passaram
- lint passou
- build passou

## Riscos e limites remanescentes

- ainda existem regras CSS antigas no repositÃ³rio que nao participam mais do shell premium
- `Dashboard`, `Time`, `Clientes` e `Calendario` agora tem frame premium, mas ainda nao foram redesenhados por completo no nivel das sub-superficies
- o bundle principal continua acima de 500 kB apos minificacao

## Estado ao final da fase

O NexusCRM passou de:

- shell premium pronto mas ainda nao conectado ao app principal

para:

- shell premium integrado no app real
- comportamento de busca reencaixado por contexto
- hierarquia de pagina restaurada nas areas legacy
- base pronta para a limpeza segura do shell antigo
