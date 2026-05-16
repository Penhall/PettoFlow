# Phase A: Fix 3 HIGH Priority Issues — NexusCRM/PettoFlow

Implement ALL THREE fixes below in the PettoFlow codebase at /root/PettoFlow.

## Issue H-01: Logout não invalida sessão Supabase

**Arquivo:** `src/context/AuthContext.jsx`

**Problema:** `supabase.auth.signOut()` não limpa a sessão corretamente. Após clicar "Sair", localStorage/sessionStorage mantém dados da sessão e o app reconhece o usuário ao recarregar.

**Correção necessária:**
1. No hook `useAuth`, na função `signOut`:
   - Chamar `supabase.auth.signOut({ scope: 'local' })`
   - Após sucesso, limpar `localStorage.clear()` e `sessionStorage.clear()`
   - Forçar recarregamento da página com `window.location.href = '/'`
2. Em `src/App.jsx`, função `handleProfileSignOut` (linha ~722):
   - Garantir que chama `signOut()` e lida com erro

**Arquivos:**
- `src/context/AuthContext.jsx`
- `src/App.jsx` (handleProfileSignOut ~linha 722)

---

## Issue H-02: Admin master sem tenant não acessa painéis admin

**Arquivo:** `src/App.jsx`

**Problema:** Quando `bootstrapError` é verdadeiro (admin master sem tenant), `renderContent()` retorna EmptyState que BLOQUEIA o conteúdo do `<main>`. Se o activeTab for uma rota admin (admin-dashboard, admin-tenants, admin-audit, admin-plans, admin-diagnostics), o painel admin não renderiza.

**Correção necessária:**
1. Criar uma função `isAdminRoute(tab)` que retorna true se tab começa com 'admin-'
2. Modificar `renderContent()` para:
   ```jsx
   if (bootstrapError && !isAdminRoute(activeTab)) {
     return <EmptyState ... />
   }
   ```
3. Quando activeTab é admin route, renderizar o conteúdo admin normalmente mesmo sem bootstrap

**Arquivos:**
- `src/App.jsx`

---

## Issue H-03: Hash routing não sincroniza activeTab

**Arquivo:** `src/App.jsx`

**Problema:** A navegação por hash (ex: `#admin-diagnostics`) não atualiza `activeTab`. O estado é gerenciado apenas via clique nos botões da sidebar, sem listener de `hashchange`.

**Correção necessária:**
1. Adicionar um useEffect que escuta `hashchange`:
   ```jsx
   useEffect(() => {
     const handler = () => {
       const hash = window.location.hash.slice(1) || 'dashboard'
       if (VALID_TABS.includes(hash) || hash.startsWith('admin-')) {
         handleTabChange(hash)
       }
     }
     window.addEventListener('hashchange', handler)
     handler() // sync on mount
     return () => window.removeEventListener('hashchange', handler)
   }, [handleTabChange])
   ```
2. Verificar se `handleTabChange` aceita tabs admin (pode precisar expandir VALID_TABS)
3. Garantir que os botões da sidebar chamam `handleTabChange` com o hash apropriado

**Arquivos:**
- `src/App.jsx`

---

## Validação

Após as correções, validar:
1. `npm run lint` — 0 warnings
2. `npm test` — todos os testes passam (260/260 esperado)
3. `npm run build` — build sem erros (~6s)

NÃO modificar testes. NÃO adicionar novas dependências. NÃO reformatar arquivos não relacionados.
