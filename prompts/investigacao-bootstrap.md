# Investigação: Fluxo de Bootstrap/Autenticação do NexusCRM

**Objetivo:** Descobrir por que a tela "Carregando NexusCRM..." fica presa intermitentemente após o refactor da estrutura premium/layouts.

## Problema
Usuário reporta que a tela de loading congela em páginas como Time, Finanças, Tenants. Precisa limpar cache para recuperar. O "Carregando NexusCRM..." fica preso e o app nunca termina de carregar.

## Verifique especialmente nos arquivos:
- `src/context/AuthContext.jsx` — fluxo de sessão, handleAuthStateChange, syncPlatformAdmin
- `src/components/auth/ProtectedRoute.jsx` — everAuthenticated ref, carregamento condicional
- `src/App.jsx` — bootstrap, lazy imports, Suspense boundaries
- `src/lib/lazyWithRetry.js` — sessionStorage retry, loop de falha
- `src/components/shared/ViewErrorBoundary.jsx` — error boundary para chunks
- `src/hooks/useAuth.js` — hook de autenticação
- `src/RootRouter.jsx` — roteamento principal
- `src/components/shell/AppShell.jsx` — shell após autenticação
- `src/lib/supabaseClient.js` — cliente Supabase
- `src/main.jsx` — entry point

## Pontos específicos para investigar:
- loops em useEffect
- race conditions (especialmente handleAuthStateChange vs loadSession)
- providers/context aninhamento (AuthProvider → TenantProvider → TenantGate → App)
- imports circulares
- Suspense/Lazy com retry infinito
- promises penduradas sem catch
- loading states sem fallback
- fluxo de autenticação e sessão (SIGNED_OUT transiente durante token refresh)
- `everAuthenticated` ref vs `initialLoadResolved` flag
- O que acontece quando `fetchWorkspaceBootstrap()` falha

## Ações:
1. Adicione logs estruturados no bootstrap para identificar em qual etapa o fluxo trava
2. Analise o fluxo completo desde `main.jsx` até o dashboard renderizado
3. Identifique a causa raiz do congelamento

## Relatório final deve conter:
- causa raiz identificada
- arquivos afetados
- fluxo quebrado
- correção aplicada
- riscos residuais
- recomendações arquiteturais para evitar novos deadlocks
