# Investigação Bootstrap/Auth — NexusCRM

Objetivo: Descobrir por que a tela "Carregando NexusCRM..." fica presa.

## Arquivos para analisar (leia todos):
- `/root/PettoFlow/src/context/AuthContext.jsx`
- `/root/PettoFlow/src/components/auth/ProtectedRoute.jsx`
- `/root/PettoFlow/src/App.jsx`
- `/root/PettoFlow/src/RootRouter.jsx`
- `/root/PettoFlow/src/hooks/useAuth.js`
- `/root/PettoFlow/src/main.jsx`
- `/root/PettoFlow/src/lib/supabaseClient.js`
- `/root/PettoFlow/src/components/shell/AppShell.jsx`
- `/root/PettoFlow/src/context/TenantContext.jsx`
- `/root/PettoFlow/src/components/tenant/TenantGate.jsx`
- `/root/PettoFlow/src/components/shared/ViewErrorBoundary.jsx`
- `/root/PettoFlow/src/lib/lazyWithRetry.js`
- `/root/PettoFlow/src/components/shared/DeferredSurface.jsx`
- `/root/PettoFlow/src/context/ThemeContext.jsx`
- `/root/PettoFlow/src/context/authContext.js`
- `/root/PettoFlow/src/context/tenantContext.js`

## Verifique:
- loops em useEffect
- race conditions: handleAuthStateChange vs loadSession
- providers aninhamento: AuthProvider → TenantProvider → TenantGate → App
- imports circulares
- Suspense/Lazy retry loop
- promises sem catch
- everAuthenticated ref vs initialLoadResolved flag
- O que acontece quando fetchWorkspaceBootstrap() falha
- syncPlatformAdmin com race condition (active flag vs State)

## Relatório:
- causa raiz
- arquivos afetados
- correções sugeridas
- riscos residuais
