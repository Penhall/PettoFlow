# Auditoria: ProtectedRoute flicker ao navegar entre abas

## Contexto

O SaaS NexusCRM (React + Vite + Supabase) apresenta um bug: ao navegar entre abas (ex: Dashboard → Finanças), o usuário vê a tela "Carregando NexusCRM... Validando a sessão atual antes de liberar o dashboard" e é redirecionado para a aba "Tarefas".

Repo: https://github.com/Penhall/PettoFlow (branch main)
Stack: Vite, React 18, Supabase Auth, lazyWithRetry code-splitting

## Instruções

Analise os arquivos abaixo e identifique a CAUSA RAIZ do problema. O sintoma é: ao clicar em um item do sidebar (ex: Finanças), o app mostra o loading do ProtectedRoute e depois cai na aba Tarefas. Isso sugere um FULL RE-RENDER ou PAGE RELOAD.

## Arquivos para analisar (leia cada um)

### 1. `/src/lib/lazyWithRetry.js`
Função que envolve React.lazy(). Quando a importação dinâmica falha com um ChunkLoadError, ela faz `window.location.reload()`. Isso causa um FULL PAGE RELOAD sempre que um chunk não carrega. **Suspeito #1.**

### 2. `/src/App.jsx`
- Linha ~96-98: Tab default é 'tarefas' se nenhum parâmetro `?tab=` estiver na URL.
- Linha ~773-775: Renderiza loading screen quando o estado `loading` do App é true.
- Linha ~107-108: `activeTab` inicializado com `readInitialAppTab()`.
- Linha ~126: `initialSettingsTab` capturado uma vez com `useState(readInitialSettingsTab)`.
- Todas as views (Dashboard, FinanceView, etc.) são lazy-loaded via `lazyWithRetry`.

### 3. `/src/RootRouter.jsx`
- Roteamento por hash (`window.location.hash.startsWith('#/admin')`).
- Quando hash muda para `#/admin`, troca de `TenantAppRoute` para `AdminRoute` — isso CAUSA UNMOUNT completo da árvore do app (TenantProvider, TenantGate, App).
- **Suspeito #2:** Se algo muda o hash acidentalmente, o app todo desmonta.

### 4. `/src/components/shell/Topbar.jsx`
- Linha 14: `onOpenAdmin = () => { window.location.hash = '/admin' }` — botão Shield muda o hash.

### 5. `/src/components/shell/SidebarRail.jsx`
- Todos os itens de navegação usam `onChange(id)` — NÃO mudam o hash.
- Itens admin (`admin-dashboard`, etc.) são tabs dentro do App, não hash routes.

### 6. `/src/components/auth/ProtectedRoute.jsx`
- Atualmente usa `useRef` para travar `everAuthenticated` — uma vez autenticado, sempre renderiza children.
- Se isso falha, o Ref pode não estar funcionando como esperado.

### 7. `/src/context/AuthContext.jsx`
- `useEffect(() => {...}, [])` — executa uma vez no mount.
- `onAuthStateChange` com callback ASYNC — Supabase espera callback síncrono.
- Linha ~80: `syncPlatformAdmin(resolvedSession, () => active).finally(...)` no listener.
- **Suspeito #3:** O callback async dentro do onAuthStateChange pode causar race conditions.

### 8. `/src/context/TenantContext.jsx`
- `TenantScopedApp` em RootRouter usa `key={activeTenantId ?? 'tenant-pending'}` (linha ~17-19 de RootRouter/App).
- Quando `activeTenantId` muda, o `key` muda e o `App` REMONTA completamente.
- **Suspeito #4:** Algo no fluxo de auth faz `activeTenantId` mudar, causando remount do App.

### 9. `/src/main.jsx`
- Hierarquia: ThemeProvider > AuthProvider > ProtectedRoute > RootRouter.
- `ProtectedRoute` envolve TODO o app — qualquer remount acima dele afeta tudo.

## Hipóteses a investigar

### Hipótese A (MAIS PROVÁVEL): `lazyWithRetry` → `window.location.reload()`
Quando o usuário clica em "Finanças", a importação lazy de `FinanceView` falha (chunk não encontrado — comum em deploys Vercel com cache de página antiga). A função `lazyWithRetry` chama `window.location.reload()`, que recarrega a página inteira. No novo carregamento:
1. ProtectedRoute mostra loading (comportamento normal de primeira carga)
2. Auth resolve
3. App renderiza com tab default = 'tarefas'

**Como verificar:** Adicione um `console.log` em `lazyWithRetry` para ver se está caindo no catch. Ou verifique se as URLs dos chunks no HTML servido correspondem aos chunks no deploy atual.

**Correção sugerida:** Substituir `window.location.reload()` por uma retentativa silenciosa do import, sem reload completo.

### Hipótese B: Remount do `TenantScopedApp` por `key={activeTenantId}`
Se o `activeTenantId` muda (ex: durante refresh de token, o TenantProvider limpa e recarrega tenants), o App remonta, resetando `activeTab` para 'tarefas' e mostrando loading.

**Como verificar:** Adicione console.log no `TenantScopedApp` para ver se ele está remontando.

### Hipótese C: Mudança acidental de hash
Se o usuário clica no botão Shield (admin) acidentalmente, ou se algum componente muda o hash, o RootRouter troca de rota, desmontando todo o app.

### Hipótese D: Callback async no `onAuthStateChange`
O Supabase client pode não tratar corretamente callbacks assíncronos no `onAuthStateChange`. Se o callback lançar uma exceção não tratada, pode corromper o estado interno do listener.

## O que entregar

1. **Diagnóstico definitivo** — qual das hipóteses (ou combinação) é a causa raiz
2. **Código de correção** para cada arquivo que precisa ser alterado
3. **Prova** — se aplicável, adicione console.log ou evidência que confirme o diagnóstico
4. **Testes** — sugestão de testes que previnam regressão

## Regras

- ES modules, indentação 2 espaços, aspas simples
- Não adicionar novas dependências
- Código deve passar em `npm run lint` e `npm test`
- `npm run build` deve compilar sem erros
