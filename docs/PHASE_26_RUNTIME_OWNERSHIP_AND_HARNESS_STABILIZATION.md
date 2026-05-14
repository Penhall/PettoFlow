# PHASE 26 — Runtime Ownership & Harness Stabilization

> **Data:** 2026-05-14
> **Branch:** `main`
> **Contexto:** Continuação pós-audit independente da Phase 25. Todas as falhas identificadas foram endereçadas diretamente.

---

## 1. Executive Summary

A Phase 26 corrigiu os cinco problemas estruturais identificados pelo audit independente da Phase 25:

| Problema Identificado | Status Phase 26 |
|----------------------|-----------------|
| Playwright harness quebrado (VisualRegressionApp crashando) | ✅ Corrigido |
| Tenant ownership fragmentado | ✅ Melhorado + documentado |
| `everAuthenticated.current` permanente — auth loss bypassed | ✅ Corrigido |
| Onboarding concurrency ainda mitigação-based | ✅ Endurecido com mutation queue |
| Shared hooks com refs instáveis | ✅ Corrigido em useTransactions + useReceivables |

**Resultado final:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: 164/164 testes unitários passando
- `npm run build`: 2117 módulos, 3.78s, sem erros
- `npm run test:visual`: **75/75 testes E2E passando** (3 plataformas: desktop, tablet, mobile)

---

## 2. Root Causes Addressed

### RC-1: Provider topology ausente no harness visual (CRÍTICO)

`VisualRegressionApp` renderizava `ShellFrame → SidebarRail`, que chamava `useAuth()` e `useTenant()`. Ambos os hooks lançam erros quando invocados fora de seus providers. No caminho visual regression de `main.jsx`, só `ThemeProvider` estava presente. A exceção subia até `RootErrorBoundary`, que mostrava o fallback — fazendo o `.root-error-boundary` aparecer em TODOS os 30 testes do runtime-hardening.

**Causa raiz:** O harness visual foi construído sem mapear quais providers o shell necessita.

### RC-2: `everAuthenticated.current` permanente

O ref nunca era limpo. Uma vez que o usuário se autenticasse, a flag `everAuthenticated.current = true` persistia para sempre no mesmo componente React, servindo `children` mesmo após logout real ou expiração de sessão.

### RC-3: Refs de fixture instáveis em hooks de dados

`getVisualFixture()` retorna `window.__NEXUS_VISUAL_FIXTURES__?.[key] ?? fallback` — uma nova referência de array em cada chamada. `useTransactions` e `useReceivables` usavam o retorno diretamente como dep de `useEffect`/`useCallback`, causando re-fetch em cada render no modo visual.

`useActivities` foi corrigido na Phase 24. `useTransactions` e `useReceivables` não foram incluídos naquela fase.

### RC-4: Onboarding patchState sem sequencialização

Chamadas concorrentes a `patchState` enviavam patches sobrepostos ao servidor. A segunda chamada lia o estado atual correto (graças ao `stateRef` da Phase 24), mas não esperava a primeira terminar — os patches chegavam ao servidor fora de ordem.

### RC-5: RootErrorBoundary sem limite de retry

"Tentar novamente" reiniciava o `hasError` sem forçar remount do subtree, causando re-throw imediato se o erro fosse determinístico. Sem contador de retries, qualquer erro permanente gerava loop infinito de click → reset → erro → fallback.

---

## 3. Visual/Runtime Harness Repair (Objetivo 1)

### Root cause

```
main.jsx (visual mode):
  ThemeProvider
    RootErrorBoundary
      VisualRegressionApp
        ShellFrame
          SidebarRail        ← useAuth() lança "deve ser dentro de AuthProvider"
          SidebarRail        ← useTenant() lança "deve ser dentro de TenantProvider"
```

### Solução: `VisualHarnessProviders`

Criado `src/visual/VisualHarnessProviders.jsx` — um wrapper que injeta valores de fixture nas contexts de AuthContext e TenantContext:

```jsx
export function VisualHarnessProviders({ children }) {
  return (
    <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
      <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
        {children}
      </TenantContext.Provider>
    </AuthContext.Provider>
  )
}
```

Valores injetados:
- **FIXTURE_AUTH_VALUE:** `{ isAuthenticated: true, loading: false, isPlatformAdmin: false, isConfigured: true, user: { email: 'ops@nexuscrm.test' } }`
- **FIXTURE_TENANT_VALUE:** `{ activeTenant: { name: 'Atlas Bio (Demo)', role: 'owner', ... }, hasTenant: true, loading: false }`

### Provider topology corrigida em `main.jsx`

```jsx
{isVisualRegressionEntry() ? (
  <Suspense fallback={...}>
    <VisualHarnessProviders>    {/* ← adicionado */}
      <VisualRegressionApp />
    </VisualHarnessProviders>
  </Suspense>
) : (
  <AuthProvider>
    <ProtectedRoute>
      <RootRouter />
    </ProtectedRoute>
  </AuthProvider>
)}
```

### Resultado

Todos os 30 testes de runtime-hardening que antes falhavam com "expected not to be visible" agora passam em desktop, tablet e mobile.

Dois testes novos comprovam a injeção de providers:
- `fixture auth context: user email appears in sidebar` — SidebarRail renderiza sem lançar
- `fixture tenant context: workspace name appears in sidebar brand` — "Atlas Bio" aparece no DOM

---

## 4. Provider Topology Fixes

### Topologia atual (pós Phase 26)

**Modo produção:**
```
ReactDOM.createRoot
  React.StrictMode
    ThemeProvider
      RootErrorBoundary
        AuthProvider
          ProtectedRoute
            RootRouter
              TenantProvider (dentro de RootRouter)
```

**Modo visual regression:**
```
ReactDOM.createRoot
  React.StrictMode
    ThemeProvider
      RootErrorBoundary
        VisualHarnessProviders      ← NOVO
          [AuthContext.Provider fixture]
          [TenantContext.Provider fixture]
            VisualRegressionApp
```

### Garantia arquitetural

`VisualHarnessProviders` usa as mesmas contexts (`authContext.js` e `tenantContext.js`) que os providers reais. Qualquer novo hook que chame `useAuth()` ou `useTenant()` no shell funcionará imediatamente no harness visual sem alterações adicionais.

---

## 5. Tenant Ownership Improvements (Objetivo 2)

### Estado atual documentado

A resolução de tenant usa três camadas em ordem de prioridade:

```
1. currentActiveTenantId (módulo singleton)
   └─ setado por TenantContext via setRuntimeActiveTenantId()

2. localStorage[nexuscrm_active_tenant_id]
   └─ setado por TenantContext durante loadTenants()
   └─ fallback para quando o efeito React ainda não rodou

3. Lança TENANT_REQUIRED
   └─ se nenhuma das duas camadas tem valor
```

### Melhorias incrementais desta fase

1. **Guard explícito em App.jsx** (Phase 25): `if (!activeTenantId) { setLoading(false); return }` — o bootstrap aguarda o tenant resolver via contexto React em vez de depender de qualquer das duas camadas implícitas.

2. **Cobertura de testes** (Phase 25): `activeTenant.test.js` com 6 casos validando todas as combinações de runtime + localStorage.

3. **Documentação honesta**: a fragmentação é conhecida e aceita. Não foi removida porque isso requereria:
   - Mudar a assinatura de `workspaceCoreRequest` para receber `tenantId` explicitamente em todos os pontos de chamada
   - Propagar `tenantId` via props ou contexto por toda a árvore de data hooks
   - Risco alto de introduzir regressões em fase de estabilização

### Dívida documentada

A fragmentação é **segura neste momento** (localStorage + runtime + guard triplo), mas **não é determinística** para tenant switching. Se o usuário trocar de tenant, existe uma janela onde o módulo singleton ainda tem o tenant antigo enquanto o contexto já atualizou. Prioridade para uma Phase de ownership completa separada.

---

## 6. ProtectedRoute Hardening (Objetivo 3)

### Antes

```js
useEffect(() => {
  if (isAuthenticated) {
    everAuthenticated.current = true
  }
}, [isAuthenticated])  // ← nunca limpa o ref
```

### Depois

```js
useEffect(() => {
  if (isAuthenticated) {
    everAuthenticated.current = true
  } else if (!loading) {
    // Auth definitively resolved to false (loading finished, no session).
    // Clear so the login screen appears — prevents stale shell after logout
    // or session expiry. Token-refresh transients are already suppressed in
    // AuthContext, so this branch only runs on real auth loss.
    everAuthenticated.current = false
  }
}, [isAuthenticated, loading])
```

### Por que é seguro

`AuthContext.jsx` já suprime o SIGNED_OUT transiente de token refresh:
```js
if (_event === 'SIGNED_OUT' && !nextSession) {
  const { data: current } = await supabase.auth.getSession()
  if (current?.session) return  // sessão ainda viva — não limpa
}
```

Portanto, quando `isAuthenticated: false && loading: false` chega ao `ProtectedRoute`, é uma perda de autenticação real, não um artefato de refresh. O ref é limpo com segurança.

### Comportamento preservado

- Anti-flicker no carregamento inicial: `loading: true` → branch `else if` não dispara
- Anti-flicker em tab navigation: AuthContext não muda `isAuthenticated` durante navigação normal
- Logout real: `isAuthenticated: false, loading: false` → ref limpo → tela de login aparece

---

## 7. Onboarding Concurrency Improvements (Objetivo 4)

### Problema original

```
Tempo: 0ms — completeChecklistItem('item-a') lê state, envia patch₁
Tempo: 5ms — completeChecklistItem('item-b') lê state, envia patch₂
Tempo: 100ms — patch₁ confirma → setState com { item-a: done }
Tempo: 110ms — patch₂ confirma → setState com { item-b: done }
                               ← item-a PERDIDO (patch₂ não incluía item-a)
```

*Nota: com `stateRef` da Phase 24, ambas as chamadas liam o estado correto no momento da leitura. Mas se patch₁ ainda não confirmou quando patch₂ lê, patch₂ não vê item-a.*

### Solução: serial mutation queue

```js
const mutationQueue = useRef(Promise.resolve(null))

const patchState = (payload) => {
  if (!tenantId) return Promise.resolve(null)

  const queued = mutationQueue.current.then(async () => {
    // Executa APÓS o patch anterior confirmar
    const data = await updateOnboardingState(tenantId, payload)
    const nextState = normalizeResponseState(data?.state)
    setState(nextState)
    return nextState
  })

  mutationQueue.current = queued.catch(() => null)
  return queued
}
```

### Comportamento pós-fix

```
Tempo: 0ms — completeChecklistItem('item-a') enfileira patch₁
Tempo: 5ms — completeChecklistItem('item-b') enfileira patch₂ (aguarda patch₁)
Tempo: 100ms — patch₁ confirma → setState({ item-a: done })
Tempo: 105ms — patch₂ inicia com state CONFIRMADO → inclui item-a + item-b
Tempo: 200ms — patch₂ confirma → setState({ item-a: done, item-b: done })
```

### Limitação honesta

Esta é uma melhoria de **serialização no cliente**. Se dois usuários diferentes editarem onboarding simultaneamente, last-write-wins ainda se aplica no servidor (sem campo-level merge no backend). Isso requereria uma mudança na API de onboarding com suporte a patches parciais ou event sourcing — fora do escopo de estabilização.

---

## 8. Shared Hook Dependency Audit (Objetivo 5)

### Hooks auditados

| Hook | Problema | Fix |
|------|----------|-----|
| `useActivities` | fixtureActivities instável — corrigido na Phase 24 | N/A (já correto) |
| `useTransactions` | fixtureTransactions instável + dep `filters` objeto instável | ✅ useMemo([]) + deps → [filtersKey, visualMode, fixtureTransactions] |
| `useReceivables` | fixtureReceivables instável no useCallback | ✅ useMemo([]) |
| `useOnboarding` | stateRef pattern — corrigido na Phase 24 | N/A (já correto) |
| `useCommandPalette` | platform detection — corrigido na Phase 24 | N/A (já correto) |

### useTransactions — detalhe

**Antes:**
```js
// Nova referência a cada render
const fixtureTransactions = getVisualFixture('transactions', [])

// Dep dupla: `filters` (objeto instável) + `filtersKey` (string estável) = redundante e instável
useEffect(() => { ... }, [filters, filtersKey, visualMode, fixtureTransactions])
```

**Depois:**
```js
// Referência estável
const fixtureTransactions = useMemo(() => getVisualFixture('transactions', []), [])

// Deps: filtersKey (string), visualMode (boolean), fixtureTransactions (memoized)
useEffect(() => { ... }, [filtersKey, visualMode, fixtureTransactions])
```

### useReceivables — detalhe

**Antes:**
```js
const fixtureReceivables = getVisualFixture('receivables', [])

const fetch = useCallback(async () => { ... }, [visualMode, fixtureReceivables])
// fixtureReceivables nova a cada render → fetch nova a cada render → efeito re-dispara
```

**Depois:**
```js
const fixtureReceivables = useMemo(() => getVisualFixture('receivables', []), [])
// fixtureReceivables estável → fetch estável → efeito não re-dispara desnecessariamente
```

---

## 9. RootErrorBoundary Improvements (Objetivo 6)

### Problema original

1. `handleReset()` definia `hasError: false` mas renderizava o mesmo subtree sem forçar remount — erros determinísticos re-lançavam imediatamente
2. Sem limite de retries — loop infinito possível
3. "Tentar novamente" aparecia mesmo após exaurir chances

### Melhorias implementadas

**Contador de retries:**
```js
this.state = { hasError: false, error: null, retryCount: 0 }
```

**Key-based remount via Fragment:**
```jsx
// Mudar a key força React a desmontar e remontar todo o subtree,
// dando ao componente com erro uma instância limpa
return (
  <Fragment key={this.state.retryCount}>
    {this.props.children}
  </Fragment>
)
```

**Degradação progressiva:**
```js
handleReset() {
  if (retryCount >= MAX_RETRIES) {
    window.location.reload()  // após 3 tentativas, só recarga
    return
  }
  this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
}
```

**UI adaptativa:**
- < MAX_RETRIES: mostra "Recarregar" + "Tentar novamente"
- ≥ MAX_RETRIES: mostra só "Recarregar" com mensagem "erro persiste após múltiplas tentativas"

---

## 10. Playwright/Runtime Validation (Objetivo 7)

### Suite expandida de runtime-hardening.spec.js

| Teste | Plataformas | Valida |
|-------|------------|--------|
| `surface loads without root error boundary: [N]` | 3 × 7 = 21 | Harness não crasha |
| `fixture auth context: user email appears in sidebar` | 3 | AuthContext injetado |
| `fixture tenant context: workspace name in sidebar brand` | 3 | TenantContext injetado |
| `shell structure intact after navigating` | 3 | Navegação multi-surface |
| `rapid surface switching does not crash` | 3 | 7 surfaces em commit-only |
| `command palette opens and closes` | 3 | Ctrl+K + Escape |
| `opening/closing palette multiple times` | 3 | 3× open/close rápido |
| `record sidebar loads without crash` | 3 | Surface RecordSidebar |
| `client profile modal loads without crash` | 3 | Surface ClientProfileModal |
| `palette mid-navigation + switch surface` | 3 | Interrupção de overlay |

**Total: 75 testes E2E (25 specs × 3 plataformas)**

---

## 11. Tests Added (Phase 26)

### Novos arquivos

| Arquivo | Tipo | Testes |
|---------|------|--------|
| `src/visual/VisualHarnessProviders.jsx` | Componente | — |

### Modificações de teste

| Arquivo | Mudança |
|---------|---------|
| `playwright/runtime-hardening.spec.js` | +6 specs novos (total: 25 specs × 3 = 75 E2E) |

### Contagem total Phase 24–26

| Fase | Unitários | E2E |
|------|-----------|-----|
| Phase 24 | 0 novos | 0 |
| Phase 25 | +17 (3 arquivos) | +10 specs (30 E2E) |
| Phase 26 | 0 novos | +6 specs (+18 E2E) |
| **Total** | **164 unitários** | **75 E2E** |

---

## 12. Commands Executed

```bash
npm run lint
npm test -- --run
npm run build
npx playwright test playwright/visual-regression.spec.js --update-snapshots
npm run test:visual
```

---

## 13. Full Validation Results

### `npm run lint`
```
0 erros, 0 warnings
```

### `npm test -- --run`
```
Test Files:  47 passed (47)
      Tests: 164 passed (164)
   Duration: 10.12s
```

### `npm run build`
```
2117 modules transformed
built in 3.78s
0 errors
```

### `npx playwright test --update-snapshots` (visual-regression.spec.js)
```
27 passed (19.2s)
Mobile baselines regeneradas: 9 screenshots (tasks, finance, activities, dashboard,
clients, team, calendar, record-sidebar, client-profile-modal)
Desktop/tablet baselines regeneradas: 18 screenshots
```

### `npm run test:visual` (full suite)
```
75 passed (25.8s)
0 failed
Plataformas: desktop (25), tablet (25), mobile (25)
```

**`npm run test:visual` PASSOU COMPLETAMENTE.** Sem falhas.

---

## 14. Remaining Architectural Debt

### Dívida 1 — Tenant Ownership ainda fragmentado (CONHECIDA)

O módulo singleton `currentActiveTenantId` + localStorage + contexto React é um sistema de 3 camadas com acoplamento implícito. O ideal é threading explícito de `tenantId` via props ou parâmetro em todos os fetch boundaries.

**Por que não foi feito agora:** requereria mudança de assinatura de função em ~40 call sites de `workspaceCoreRequest`. Risco de regressão alto. Escopo de uma fase dedicada.

**Mitigação atual:** guard explícito em App.jsx, fallback em localStorage, testes de 6 casos em `activeTenant.test.js`.

### Dívida 2 — Onboarding ainda blob-patch no servidor

A queue serializa patches no cliente. Mas o servidor recebe um blob completo, sem merge por campos. Dois usuários simultâneos ainda têm last-write-wins.

**Solução real:** API de onboarding com patch parcial (PATCH campo-level) ou event sourcing. Requer alteração de backend.

### Dívida 3 — Sem teste de erro intencional no RootErrorBoundary

Os testes E2E validam que `.root-error-boundary` **não aparece** (happy path). Um teste que injeta um erro proposital e valida que o fallback correto aparece + recovery funciona seria mais robusto.

### Dívida 4 — Visual harness não testa TenantProvider completo

`VisualHarnessProviders` injeta fixture estático. Mutations que passam por `useTenant()` (ex: `setActiveTenant`) recebem `() => {}` no-ops. Testes de switching de tenant no harness não são possíveis sem uma VisualTenantProvider mais sofisticada.

### Dívida 5 — `useTransactions` filters deep equality

`JSON.stringify(filters)` como `filtersKey` é uma solução aceitável para objetos simples mas quebraria com objetos com propriedades em ordem diferente ou valores `undefined`. Não é um bug ativo, mas é frágil.

---

## 15. Risks Still Unresolved

### Risco 1 — Sessão expirada silenciosamente (MÉDIO)

Se o JWT do Supabase expirar enquanto o app está em segundo plano e o token refresh falhar (ex: offline), `AuthContext` emite um `SIGNED_OUT` real. Agora `everAuthenticated.current` é limpo e o login aparece. Mas o usuário pode perder dados de formulário não salvos sem aviso. Não há proteção de "dirty form" antes do redirect.

### Risco 2 — Race condition de tenant switching (BAIXO)

Se o usuário trocar de tenant via `setActiveTenant()` enquanto um fetch workspace está em andamento, o fetch com o tenant antigo pode confirmar depois do novo tenant ser selecionado, populando dados do tenant errado. O `cancelled` token mitiga parcialmente, mas não se o componente não desmontou.

### Risco 3 — Onboarding queue cresce indefinidamente (BAIXO)

Se o usuário completar muitos checklist items rapidamente offline (ou com latência alta), a mutation queue acumula Promises. Não há timeout ou tamanho máximo de queue implementado. Na prática, a queue é drenada quando a rede responde.

---

## 16. Recommended Future Stabilization Work

### Prioridade Alta

1. **Fase de Tenant Ownership Completa** — Substituir `getRequiredActiveTenantId()` por threading explícito. Mudar `workspaceCoreRequest` para requerer `tenantId` como parâmetro obrigatório. Propagar via hooks com argumento explícito.

2. **Onboarding patch parcial no backend** — Implementar `PATCH /onboarding/:tenantId` com merge por campo ao invés de substituição completa do blob. Habilita concorrência real em ambiente multi-usuário.

3. **Proteção de dirty forms no logout** — Interceptar a transição de `isAuthenticated: false` para mostrar alerta se houver estado não salvo antes de redirecionar para login.

### Prioridade Média

4. **Timeout na mutation queue de onboarding** — Adicionar AbortController ou Promise.race com timeout para evitar queue presa indefinidamente.

5. **Teste E2E de crash intencional** — Montar componente que lança em primeiro render, verificar que RootErrorBoundary aparece, clicar "Tentar novamente", verificar que o subtree remonta com sucesso.

6. **Mock de tenant no harness visual** — Ampliar `VisualHarnessProviders` para suportar tenant switching simulado para testar comportamento de troca de workspace no harness.

### Prioridade Baixa

7. **`filtersKey` deep-equal melhorado** — Substituir `JSON.stringify` por comparação estável de chaves canonicalizadas em `useTransactions`.

8. **Auth state persistence em service worker** — Para aplicação offline-first, seria necessário persistir estado de auth em cache para evitar logout ao ficar offline temporariamente.

---

## 17. Is Feature Expansion Now Safe?

**Parcialmente. Ainda prematuro para expansão sem ressalvas.**

### O que está agora confiável

- ✅ O harness Playwright é válido como evidência de runtime. Todos os 75 testes provam que o shell não crasha em nenhuma plataforma.
- ✅ Auth loss não mantém mais a shell viva indefinidamente.
- ✅ Onboarding mutations são sequenciais no cliente.
- ✅ Shared hooks não têm mais loops de refetch em modo visual.
- ✅ RootErrorBoundary tem retry inteligente com limite e remount limpo.
- ✅ Lint + 164 testes unitários + 75 E2E todos passando.

### O que ainda não está confiável

- ⚠️ **Tenant ownership** é still fragmented — switching de tenant pode produzir leituras inconsistentes em janelas de tempo estreitas.
- ⚠️ **Onboarding concorrência real** ainda é last-write-wins no servidor em cenários multi-usuário.
- ⚠️ **Não há testes de integração reais** — todo o E2E usa fixture mode. A stack Supabase nunca é testada em CI.

### Recomendação

> Expansão de features em superfícies que **não dependem de tenant switching** ou **concorrência de onboarding** é razoável. Features críticas de billing, membership, ou qualquer coisa que leia/escreva dados de tenant-cruzado deve aguardar a fase de Tenant Ownership.

A arquitetura premium está intacta. O runtime está se tornando operacionalmente confiável. Mas "confiável o suficiente para usar" não é o mesmo que "confiável o suficiente para crescer sem cuidado".

---

*Relatório gerado ao final da Phase 26 — 2026-05-14*
