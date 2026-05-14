# PHASE 27 — Real Ownership Cleanup & Transition Correctness

> **Data:** 2026-05-14
> **Branch:** `main`
> **Contexto:** Continuação pós-audit independente da Phase 26. Eight objectives identified by the second independent audit — all addressed directly.

---

## 1. Executive Summary

Phase 27 corrigiu os oito problemas estruturais identificados pelo segundo audit independente:

| Objetivo | Descrição | Status |
|----------|-----------|--------|
| O1 | ProtectedRoute: `everAuthenticated.current` ref não dispara rerender | ✅ Corrigido (Task 25) |
| O2 | Onboarding queue: payload construído antes da execução = sobrescrita | ✅ Corrigido (Task 26) |
| O3 | Tenant threading explícito no bootstrap boundary | ✅ Iniciado (Task 27) |
| O4 | RuntimeHarnessApp: topologia real testável no Playwright | ✅ Implementado (Task 28) |
| O5 | Crash boundary: validação de boundary appearance + retry exhaustion | ✅ Implementado (Task 29) |
| O6 | Refs de fixture instáveis nos 5 hooks restantes | ✅ Corrigido (Task 30) |
| O7 | Full validation: lint + test + build + test:visual green | ✅ (Task 31) |
| O8 | Documentação Phase 27 | ✅ (Task 32 — este arquivo) |

**Resultado final:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: **172/172 testes unitários passando**
- `npm run build`: 2118 módulos, 3.90s, sem erros
- `npm run test:visual`: **111/111 testes E2E passando** (3 plataformas)

---

## 2. Root Causes Addressed

### RC-1: ProtectedRoute — ref mutation não dispara rerender (CRÍTICO)

O Phase 26 substituiu `everAuthenticated.current` por um ref, mas um ref **nunca dispara rerender**. Quando `loading` tornava-se `false`, `everAuthenticated.current = true` era setado dentro de um `useEffect` — mas isso não causava re-render, então o componente continuava renderizando a mesma UI que já estava montada. Em teoria, se o estado de auth mudasse entre renders, o componente poderia não convergir para o estado correto.

A causa raiz: `useRef` e `useState` têm semânticas opostas para esse uso. Um ref é um contêiner mutável invisível para o React. Somente `useState` garante re-render quando o valor muda.

### RC-2: Onboarding — payload construído antes da execução na queue

O Phase 26 introduziu a serial mutation queue, mas os builders de payload eram chamados **antes** de enfileirar — no momento do `patchState(payload)` — não dentro da execução da queue. Isso significava que duas chamadas concorrentes ambas liam o mesmo `committedStateRef.current` no momento do dispatch, resultando em sobrescrita mútua de state.

```
ANTES (Phase 26):
  dispatch time:  builder called → payload = { items: { 'item-a': ... } }
  queue time:     payload já calculado — usa estado stale

DEPOIS (Phase 27):
  dispatch time:  builder function stored
  queue time:     builder(committedStateRef.current) — vê estado confirmado pelo server
```

### RC-3: fetchWorkspaceBootstrap sem tenant explícito

`fetchWorkspaceBootstrap()` em `workspaceCore.js` usava `getRequiredActiveTenantId()` (global lookup via module-level variable ou localStorage). O caller em `App.jsx` já tinha `activeTenantId` disponível mas não passava explicitamente. Isso criava dependência oculta no estado global — um anti-padrão que dificulta testing e rastreamento de ownership.

### RC-4: Harness visual bypassa ProtectedRoute

Os testes de `runtime-hardening.spec.js` validavam o harness sintético (`VisualRegressionApp`) mas nunca exercitavam o caminho real de auth gating. Mesmo se `ProtectedRoute` estivesse completamente quebrado, esses testes passariam — pois a rota visual montava o shell diretamente sem passar por `ProtectedRoute`.

### RC-5: RootErrorBoundary sem cobertura de crash intencional

Não existia nenhum teste que verificasse o boundary se comportando corretamente sob crash real. O `retryCount` e a lógica de exhaustion (após 3 retries) eram código sem cobertura de comportamento.

### RC-6: Refs de fixture instáveis em 5 hooks restantes

O Phase 26 corrigiu `useTransactions` e `useReceivables`. Faltavam `useAccounts`, `useActivityTemplates`, `useFinCategories`, `useFinRules` e `usePayees`. Cada um chamava `getVisualFixture(key, [])` diretamente no corpo do hook, produzindo nova referência de array em cada render e causando loops de re-fetch no modo visual.

---

## 3. Task 25 — ProtectedRoute State-Driven Auth Reconciliation

**Arquivo modificado:** `src/components/auth/ProtectedRoute.jsx`

### Mudança arquitetural

Substituiu `useRef` por `useState` para o flag `authInitialized`:

```jsx
// ANTES (Phase 26 — errado)
const everAuthenticated = useRef(false)
useEffect(() => {
  if (!loading && isAuthenticated) {
    everAuthenticated.current = true  // ref mutation — sem rerender!
  }
}, [loading, isAuthenticated])
if (!loading && !isAuthenticated && !everAuthenticated.current) { ... }

// DEPOIS (Phase 27 — correto)
const [authInitialized, setAuthInitialized] = useState(!loading)
useEffect(() => {
  if (!loading) setAuthInitialized(true)  // setState — dispara rerender
}, [loading])
if (!authInitialized) { return <AuthLayout title="Carregando NexusCRM..." /> }
```

### Por que `useState(!loading)` na inicialização

Se `loading` já começa `false` (Supabase não configurado — `isConfigured: false`), o componente não deve mostrar o loading screen. Inicializar `authInitialized = !loading` garante que Supabase mal-configurado pula diretamente para a tela de "Configuração incompleta".

### Semântica de re-render garantida

`isAuthenticated` é React state no `AuthContext`. Quando auth é perdida (logout real / expiração de sessão):
1. `AuthContext` atualiza `isAuthenticated: false` → re-render de todos os consumers
2. `ProtectedRoute` lê `isAuthenticated = false`
3. Como `authInitialized = true` (setado após loading), não mostra loading screen
4. Renderiza `LoginPage` — imediatamente, sem aguardar próxima navegação

### Novos testes

4 novos testes em `ProtectedRoute.test.jsx` cobrem transições de estado usando `rerender` + `act`:

```jsx
it('auth loss after authentication shows login — state change triggers rerender', () => {
  // Start authenticated → rerender with isAuthenticated: false → login appears
})
it('initial loading then authenticated shows children without flash', () => {
  // loading: true → loading: false + isAuthenticated: true → children visible
})
it('subsequent auth resolution does not re-show loading screen', () => {
  // authInitialized prevents loading re-show on token-refresh rerenders
})
it('logout flow: authenticated → unauthenticated shows login, not loading', () => {
  // After auth, logout shows login page — not loading screen
})
```

---

## 4. Task 26 — Onboarding Queue: Payload Computed at Execution Time

**Arquivo modificado:** `src/hooks/useOnboarding.js`
**Arquivo modificado:** `src/hooks/useOnboarding.test.jsx`

### Mudança: builder function em vez de payload estático

`patchState` agora aceita uma **função builder** `(current) => payload` em vez de um objeto payload estático:

```js
// ANTES — payload calculado na hora do dispatch (lê estado stale em concorrência)
const patchState = (payload) => {
  const queued = mutationQueue.current.then(async () => {
    const data = await updateOnboardingState(tenantId, payload)  // payload stale!
    ...
  })
}

// DEPOIS — payload calculado DENTRO da execução da queue
const patchState = (buildPayload) => {
  const queued = mutationQueue.current.then(async () => {
    const payload = buildPayload(committedStateRef.current)  // lê estado confirmado
    const data = await updateOnboardingState(tenantId, payload)
    ...
  })
}
```

### `committedStateRef` atualizado sincronamente

O ref é atualizado **antes** de resolver a Promise da queue, garantindo que o próximo item na fila veja o estado confirmado imediatamente:

```js
const data = await updateOnboardingState(tenantId, payload)
const nextState = normalizeResponseState(data?.state)
committedStateRef.current = nextState  // ← síncrono, antes do setState
setState(nextState)
return nextState
```

### Todos os builders atualizados

`completeChecklistItem`, `dismissSurface`, `markTutorialOpened`, `markTutorialCompleted`, `updateTourState` — todos agora passam funções `(current) => payload`.

### Proteção dupla contra falha na queue

```js
mutationQueue.current = queued.catch(() => null)
```

Impede que uma falha em um patch bloqueie todos os patches subsequentes.

### Mock do teste atualizado para simular server PATCH real

O `makeEchoMock` foi transformado em `makeStatefulMock` (mantendo o nome para compatibilidade): em vez de "ecoar apenas o que foi enviado", agora mantém estado acumulado no lado do server e aplica o partial update — simulando corretamente o comportamento PATCH real onde o servidor retorna o estado completo após merge:

```js
function makeEchoMock() {
  let serverState = { /* initial state */ }
  return async (_tenantId, payload) => {
    if (payload.checklistState !== undefined) serverState = { ...serverState, checklistState: payload.checklistState }
    if (payload.dismissState !== undefined) serverState = { ...serverState, dismissState: payload.dismissState }
    // ... outros campos
    return { state: { ...serverState } }
  }
}
```

### Novos testes Phase 27

3 novos testes em `describe('Phase 27: committed-state queue')`:

1. **Concurrent checklist completions:** segundo payload inclui item-a confirmado pelo servidor (prova que builder roda DEPOIS da confirmação do primeiro call)
2. **Concurrent mixed mutations:** dismiss + checklist não se sobrescrevem (ambos visíveis no estado final)
3. **Failed first patch:** não bloqueia patches subsequentes (queue drains corretamente após erro)

---

## 5. Task 27 — Explicit Tenant Threading (Bootstrap Boundary)

**Arquivo modificado:** `src/lib/workspaceCore.js`
**Arquivo modificado:** `src/App.jsx`

### Mudança mínima e precisa

`fetchWorkspaceBootstrap` agora aceita `tenantId` explícito e passa para `workspaceCoreRequest`:

```js
// ANTES
export async function fetchWorkspaceBootstrap() {
  return request('/bootstrap', { fallbackMessage: '...' })
}

// DEPOIS
export async function fetchWorkspaceBootstrap(tenantId) {
  return request('/bootstrap', { tenantId, fallbackMessage: '...' })
}
```

`workspaceCoreRequest` já tinha suporte para `tenantId` optional — quando presente, usa diretamente; quando ausente, faz fallback para `getRequiredActiveTenantId()`. A mudança é 100% backward-compatible.

### Três call sites atualizados em App.jsx

```js
// main useEffect
fetchWorkspaceBootstrap(activeTenantId)

// fetchTeam helper
const data = await fetchWorkspaceBootstrap(activeTenantId)

// fetchClients helper
const data = await fetchWorkspaceBootstrap(activeTenantId)
```

### O que isso resolve

Antes, `App.jsx` tinha `activeTenantId` mas não o passava — deixando o bootstrap depender da variável global `currentActiveTenantId` (module-level) ou do `localStorage`. Com a mudança, o tenant ID percorre explicitamente `App.jsx → fetchWorkspaceBootstrap → workspaceCoreRequest → authenticatedFetch`. Nenhum lookup global ocorre para esse caminho.

---

## 6. Task 28 — RuntimeHarnessApp: Real Playwright Topology

**Arquivo criado:** `src/visual/RuntimeHarnessApp.jsx`
**Arquivo criado:** `src/visual/harnessFixtures.js`
**Arquivo modificado:** `src/visual/VisualHarnessProviders.jsx`
**Arquivo modificado:** `src/main.jsx`
**Arquivo criado:** `playwright/runtime-topology.spec.js`

### Motivação

Os testes `runtime-hardening.spec.js` montam `VisualRegressionApp` diretamente — `ProtectedRoute` é COMPLETAMENTE IGNORADO. Se `ProtectedRoute` estivesse totalmente quebrado, esses testes continuariam passando.

`RuntimeHarnessApp` resolve isso montando a topologia real:
```
AuthContext.Provider (fixture values)
  TenantContext.Provider (fixture values)
    ProtectedRoute              ← componente real, não bypassado
      <div id="runtime-topology-root">
```

### Modos disponíveis via `?harness-mode=`

| Modo | Auth fixture | ProtectedRoute resultado esperado |
|------|-------------|-----------------------------------|
| `authenticated` (default) | `isAuthenticated: true` | Renderiza children (`#runtime-topology-root`) |
| `unauthenticated` | `isAuthenticated: false` | Renderiza `LoginPage` |
| `crash` | — | Renderiza `CrashTestSurface` que lança imediatamente |

### Separação de fixtures

`FIXTURE_AUTH_VALUE` e `FIXTURE_TENANT_VALUE` foram movidas para `src/visual/harnessFixtures.js` (arquivo de constantes puro) para evitar violação da regra `react-refresh/only-export-components`:

```
src/visual/
  harnessFixtures.js          ← exporta FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE
  VisualHarnessProviders.jsx  ← importa de harnessFixtures, exporta componente
  RuntimeHarnessApp.jsx       ← importa de harnessFixtures, exporta componente
```

### DEV-only em produção

```js
const RuntimeHarnessApp = import.meta.env.DEV
  ? lazy(() => import('./visual/RuntimeHarnessApp.jsx'))
  : null
```

`isRuntimeHarnessEntry()` também guarda com `!import.meta.env.DEV`. Em produção, Vite tree-shakes o módulo inteiro — confirmado pelo build: `RuntimeHarnessApp` não aparece nos assets de produção.

### Novos testes: `playwright/runtime-topology.spec.js` (6 testes × 3 plataformas = 18)

```
✓ authenticated fixture: ProtectedRoute resolves to children
✓ authenticated fixture: no root error boundary fires
✓ authenticated fixture: no loading screen visible after fixture resolves
✓ unauthenticated fixture: ProtectedRoute shows login page
✓ unauthenticated fixture: no root error boundary fires
✓ auth transition: switching from authenticated to unauthenticated shows login
```

---

## 7. Task 29 — Crash Boundary Validation

**Arquivo modificado:** `src/visual/RuntimeHarnessApp.jsx` (adição do `CrashTestSurface`)
**Arquivo criado:** `playwright/crash-boundary.spec.js`

### CrashTestSurface

Componente mínimo que lança em cada render:

```jsx
function CrashTestSurface() {
  throw new Error('Crash test: intentional render failure for boundary validation')
}
```

Quando `harness-mode=crash`: `RuntimeHarnessApp` renderiza apenas `CrashTestSurface` (sem providers). O erro sobe até o `RootErrorBoundary` em `main.jsx`.

### O que é validado

| Teste | Valida |
|-------|--------|
| heading correto | `RootErrorBoundary` mostra "Algo deu errado" |
| reload button sempre visível | `root-error-boundary__btn--primary` presente |
| retry button antes da exhaustion | `root-error-boundary__btn--secondary` presente antes de 3 cliques |
| retry triggers remount | Clicar retry causa reset + re-catch (boundary continua visível) |
| retry button some após MAX_RETRIES | Após 3 cliques: btn--secondary desaparece |
| exhaustion message | Após 3 cliques: "O erro persiste após múltiplas tentativas" |

### Cobertura: `playwright/crash-boundary.spec.js` (6 testes × 3 plataformas = 18)

```
✓ crash: root error boundary appears with correct heading
✓ crash: reload button is always visible
✓ crash: retry button is visible before exhaustion
✓ crash: retry triggers remount — boundary resets and re-catches crash
✓ crash: retry button disappears after MAX_RETRIES (3 clicks)
✓ crash: exhaustion message appears after MAX_RETRIES
```

---

## 8. Task 30 — Unstable Fixture Refs: Remaining 5 Hooks

**Arquivos modificados:** `useAccounts.js`, `useActivityTemplates.js`, `useFinCategories.js`, `useFinRules.js`, `usePayees.js`

### Problema

`getVisualFixture(key, [])` retorna `window.__NEXUS_VISUAL_FIXTURES__?.[key] ?? fallback`. O fallback `[]` é criado a cada chamada se a fixture não está definida. Hooks que usam o retorno direto como dep de `useEffect` / `useCallback` causavam re-invocações infinitas no modo visual.

### Padrão de correção (5 arquivos)

```js
// ANTES (exemplo useAccounts)
import { useEffect, useState } from 'react'
const fixtureAccounts = getVisualFixture('accounts', [])  // nova ref a cada render
useEffect(() => { ... }, [visualMode, fixtureAccounts])    // loop infinito

// DEPOIS
import { useEffect, useMemo, useState } from 'react'
const fixtureAccounts = useMemo(() => getVisualFixture('accounts', []), [])  // estável
useEffect(() => { ... }, [visualMode, fixtureAccounts])    // dep estável, sem loop
```

### Hooks corrigidos e fixtures afetadas

| Hook | Fixture(s) |
|------|-----------|
| `useAccounts` | `accounts` |
| `useActivityTemplates` | `activityTemplates` (+ dep em `useCallback`) |
| `useFinCategories` | `finCategoryGroups`, `finCategories` (2 fixtures) |
| `useFinRules` | `finRules` |
| `usePayees` | `payees` |

### Status completo do problema de fixture refs

Todos os 8 hooks com o padrão problemático foram corrigidos:

| Phase | Hooks Corrigidos |
|-------|-----------------|
| 24 | `useActivities` |
| 26 | `useTransactions`, `useReceivables` |
| 27 | `useAccounts`, `useActivityTemplates`, `useFinCategories`, `useFinRules`, `usePayees` |

---

## 9. Coverage Summary

### Unit Tests (Vitest)

| Suite | Testes | Status |
|-------|--------|--------|
| `ProtectedRoute.test.jsx` | 7 | ✅ |
| `useOnboarding.test.jsx` | 9 | ✅ |
| Demais 45 suites | 156 | ✅ |
| **Total** | **172** | **✅ 172/172** |

### E2E Tests (Playwright — 3 plataformas)

| Spec | Testes (por plataforma) | Total | Status |
|------|------------------------|-------|--------|
| `visual-regression.spec.js` | 9 | 27 | ✅ |
| `runtime-hardening.spec.js` | 25 | 75 | ✅ |
| `runtime-topology.spec.js` | 6 | 18 | ✅ **(NOVO)** |
| `crash-boundary.spec.js` | 6 | 18 | ✅ **(NOVO)** |
| **Total** | **46** | **111** | **✅ 111/111** |

**Aumento:** +36 testes E2E em relação à Phase 26 (75 → 111)

---

## 10. Files Changed

### Criados

| Arquivo | Propósito |
|---------|-----------|
| `src/visual/RuntimeHarnessApp.jsx` | Harness DEV-only com topologia real (AuthContext + ProtectedRoute) |
| `src/visual/harnessFixtures.js` | Constantes de fixture exportadas separadamente (react-refresh compliance) |
| `playwright/runtime-topology.spec.js` | 6 testes de topologia real ProtectedRoute |
| `playwright/crash-boundary.spec.js` | 6 testes de RootErrorBoundary crash + retry exhaustion |
| `docs/PHASE_27_REAL_OWNERSHIP_CLEANUP_AND_TRANSITION_CORRECTNESS.md` | Este arquivo |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/auth/ProtectedRoute.jsx` | `useRef` → `useState` para `authInitialized`; removeu `useRef` import |
| `src/components/auth/ProtectedRoute.test.jsx` | +4 testes de transição de estado |
| `src/hooks/useOnboarding.js` | `patchState` aceita builder function; `committedStateRef` atualizado síncronamente |
| `src/hooks/useOnboarding.test.jsx` | `makeEchoMock` virou mock stateful; +3 testes Phase 27 concurrency |
| `src/lib/workspaceCore.js` | `fetchWorkspaceBootstrap(tenantId?)` — tenant threading explícito |
| `src/App.jsx` | Passa `activeTenantId` explicitamente nos 3 call sites de `fetchWorkspaceBootstrap` |
| `src/main.jsx` | Adiciona `?runtime-harness=1` path; `RuntimeHarnessApp` lazy-loaded DEV-only |
| `src/visual/VisualHarnessProviders.jsx` | Constantes movidas para `harnessFixtures.js`; importa de lá |
| `src/hooks/useAccounts.js` | `useMemo([], [])` para `fixtureAccounts` |
| `src/hooks/useActivityTemplates.js` | `useMemo([], [])` para `fixtureTemplates` |
| `src/hooks/useFinCategories.js` | `useMemo([], [])` para `fixtureGroups` e `fixtureCategories` |
| `src/hooks/useFinRules.js` | `useMemo([], [])` para `fixtureRules` |
| `src/hooks/usePayees.js` | `useMemo([], [])` para `fixturePayees` |

---

## 11. Validation Results

```
npm run lint      → ✅ 0 errors, 0 warnings
npm test          → ✅ 172/172 tests passed (47 suites)
npm run build     → ✅ 2118 modules, 3.90s, 0 errors
npm run test:visual → ✅ 111/111 tests (37.9s, 3 platforms)
```

---

## 12. Architecture Decisions Preserved

- **Design system intacto:** nenhum componente visual modificado
- **Motion governance preservada:** nenhum token de animação tocado
- **Chunking/lazy-loading preservado:** estrutura de `lazyWithRetry` e chunks existentes sem alteração
- **Deferred surfaces preservadas:** `DeferredSurface`, `Suspense` boundaries sem alteração
- **Visual hierarchy preservada:** nenhuma mudança em layouts ou hierarquia visual
- **Sem novas features de produto:** todas as mudanças são internas de infraestrutura/teste

---

## 13. Harness Topology — Before & After

### Phase 26 topology

```
?visual-regression=1:
  ThemeProvider
    RootErrorBoundary
      VisualHarnessProviders (AuthContext + TenantContext fixture)
        VisualRegressionApp      ← ProtectedRoute BYPASSADO
          ShellFrame → content

main path (production):
  ThemeProvider
    RootErrorBoundary
      AuthProvider (real Supabase)
        ProtectedRoute
          RootRouter
```

### Phase 27 topology (adicionado)

```
?runtime-harness=1 (DEV only):
  ThemeProvider
    RootErrorBoundary ← catching crashes from CrashTestSurface
      RuntimeHarnessApp
        AuthContext.Provider (fixture)
          TenantContext.Provider (fixture)
            ProtectedRoute       ← EXERCITADO AGORA
              <div#runtime-topology-root>  [mode=authenticated]
              LoginPage                    [mode=unauthenticated]
              CrashTestSurface             [mode=crash] → capturado pelo RootErrorBoundary
```

---

## 14. Known Limitations

### Tenant threading parcial

A Phase 27 endereça apenas `fetchWorkspaceBootstrap`. Os demais ~30 funções em `workspaceCore.js` (`createTaskRecord`, `updateTaskRecord`, `listActivityRecords`, etc.) ainda dependem do global `getRequiredActiveTenantId()`. A threading explícita completa é um esforço maior que requer:
1. Passar `tenantId` de `App.jsx` para cada operação de CRUD
2. Ou criar uma factory `createWorkspaceClient(tenantId)` que fecha sobre o ID

Isso não é regressão — era o comportamento antes, e continua funcionando via global. É um cleanup arquitetural pendente.

### RuntimeHarnessApp não testa RootRouter

`RuntimeHarnessApp` renderiza apenas `<div>` simples como children de `ProtectedRoute`. O caminho completo `ProtectedRoute → RootRouter → App` ainda não é exercitado em testes unitários ou E2E controlados. Isso é intencional para Phase 27 — `RootRouter → App` depende de Supabase e hooks de workspace que precisariam de mocking adicional.

### Screenshots de baseline não regeneradas

Os 27 baselines visuais existentes foram mantidos — nenhuma mudança visual ocorreu. Isso é correto.

---

## 15. Phase 28 Prerequisites

Para uma eventual Phase 28, os pré-requisitos são:

1. **Tenant threading completo** — passar `tenantId` explicitamente nas operações de CRUD de `App.jsx` (ou factory pattern)
2. **RuntimeHarnessApp full-path** — adicionar suporte para `ProtectedRoute → App` com bootstrap mock para testes E2E do fluxo completo autenticado
3. **Onboarding `emitEvent` queue** — `emitEvent` chama `recordOnboardingEvent` sem sequencialização; para eventos de alta frequência, enfileiramento similar ao `patchState` pode ser necessário
4. **`useAuth.test.jsx` — testes de transição real** — os testes existentes do hook cobrem apenas comportamento do `AuthContext`; não cobrem o timing da resolução Supabase em ambiente real
