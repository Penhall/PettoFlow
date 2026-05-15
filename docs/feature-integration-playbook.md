# Feature Integration Playbook

> Como adicionar features com segurança no runtime orquestrado do NexusCRM.
> Versão: 1.0 — Phase 32

---

## Princípios Gerais

1. **Toda feature é tenant-aware.** Se opera com dados, recebe `tenantId`.
2. **Toda operação async é cancellable.** Use `AbortController` + cleanup effect.
3. **Toda transição é registrada.** Use `startTransition()`/`completeTransition()`.
4. **Toda falha é classificada.** Use `traceAsyncFailure()` com tipo apropriado.
5. **Nunca confie em globals.** `getRequiredActiveTenantId()` é exceção, não regra.

---

## 1. Como Adicionar uma Feature Tenant-Aware

### ✅ Padrão Correto

```jsx
// hooks/useMinhasCoisas.js
export function useMinhasCoisas(tenantId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    let active = true
    const controller = new AbortController()

    async function fetchData() {
      try {
        const result = await authenticatedFetch(
          `${API_URL}/minhas-coisas`,
          { tenantId, signal: controller.signal }
        )
        if (!active) return
        const json = await result.json()
        setData(json)
      } catch (err) {
        if (controller.signal.aborted) return
        traceAsyncFailure('async-event', err, { hook: 'useMinhasCoisas', tenantId })
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchData()

    return () => {
      active = false
      controller.abort()
    }
  }, [tenantId])

  return { data, loading }
}
```

```jsx
// Componente que consome
function MinhasCoisas() {
  const { activeTenantId } = useTenant()
  const { data, loading } = useMinhasCoisas(activeTenantId)
  // ...
}
```

### ❌ Padrão Proibido

```jsx
// ❌ NÃO FAÇA: tenantId implícito via contexto dentro do hook
export function useMinhasCoisas() {
  const { activeTenantId } = useTenant()  // hidden dependency!
  // ...
}

// ❌ NÃO FAÇA: sem cancellation
useEffect(() => {
  fetchData().then(setData)  // setState após unmount!
}, [])
```

---

## 2. Como Propagar TenantId

A cadeia de propagação correta:

```
View/Page
  → Hook de dados(tenantId)
    → workspaceCore.operation(tenantId, ...)
      → authenticatedFetch(url, { tenantId })
        → Header: X-Tenant-Id: <tenantId>
```

### Onde obter `tenantId`:

| Local | Fonte |
|-------|-------|
| Componente de página | `useTenant().activeTenantId` |
| Hook de dados | Parâmetro recebido do componente |
| workspaceCore | Parâmetro `tenantId` |
| Edge Function | Header `X-Tenant-Id` |
| authenticatedFetch | Options `{ tenantId }` |

### ⚠️ Exceção: `getRequiredActiveTenantId()`

Usar **apenas** quando:
1. O código não tem acesso ao tenantId do componente chamador
2. É uma operação de bootstrap inicial (ex: `workspaceCore.fetchWorkspaceBootstrap`)
3. Nunca dentro de hooks de dados que podem ser chamados com tenant diferente

---

## 3. Como Registrar Transições no Orquestrador

### Quando registrar:

| Situação | Ação |
|----------|------|
| Usuário troca de tenant | `startTransition('tenant', { from, to })` |
| Navegação entre rotas | `startTransition('route', { from, to })` |
| Operação longa (upload, sync) | `startTransition('custom-op', { detail })` |
| Operação concluída | `completeTransition('kind')` |
| Operação interrompida | `interruptTransition('kind')` |

### Exemplo:

```jsx
function TenantSwitcher() {
  const { startTransition, completeTransition } = useRuntimeOrchestration()

  function handleSwitch(tenantId) {
    startTransition('tenant', {
      from: currentTenantId,
      to: tenantId,
      detail: { source: 'switcher-click' },
    })

    setActiveTenant(tenantId)
    // completeTransition é chamado pelo TenantContext
    // quando o tenant termina de carregar
  }
}
```

---

## 4. Como Integrar Cancellation

### Em hooks de dados (useEffect):

```jsx
useEffect(() => {
  if (!tenantId) return

  let active = true
  const controller = new AbortController()

  async function load() {
    try {
      const data = await fetchSomething(tenantId, controller.signal)
      if (active) setData(data)
    } catch (err) {
      if (!controller.signal.aborted) {
        traceAsyncFailure('async-event', err, { tenantId })
      }
    } finally {
      if (active) setLoading(false)
    }
  }

  load()
  return () => { active = false; controller.abort() }
}, [tenantId])
```

### Em operações do orquestrador:

```jsx
const requestId = startTenantLoad('user-action')

// Se o usuário navegar antes de completar:
cancelTenantLoad(requestId, { reason: 'navigation-during-load' })
// O reducer ignora respostas com requestId obsoleto
```

---

## 5. Como Escrever Playwright Tests para Mounted-Runtime

```js
// playwright/runtime-hardening.spec.js (exemplo)
test('app survives tenant switch without crashing', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-nexus-runtime-phase="APP_READY"]')

  await page.click('[data-testid="tenant-switcher"]')
  await page.click('[data-testid="tenant-item-2"]')

  // Verifica que o app não crashou
  await expect(page.locator('#root')).not.toContainText('error')
  await expect(page.locator('[data-nexus-runtime-phase="APP_READY"]')).toBeVisible()
})
```

### Padrões:
- Use `data-nexus-runtime-phase` para verificar fases
- Teste transições: tenant switch, navegação rápida, retry
- Teste cancellation: dispare navegação durante carregamento

---

## 6. Como Evitar Stale Commits

### Problema:
```jsx
useEffect(() => {
  fetchData().then(setData)  // Se tenantId mudar, setData sobrescreve com dado antigo
}, [tenantId])
```

### Solução:
```jsx
useEffect(() => {
  let active = true
  fetchData().then((data) => {
    if (active) setData(data)  // Só aplica se ainda é o efeito atual
  })
  return () => { active = false }
}, [tenantId])
```

### No reducer:
```js
// O runtimeOrchestration reducer já faz staleness check por requestId:
if (action.payload.requestId < state.tenant.requestId) {
  return state  // Ignora resposta obsoleta
}
```

---

## 7. Como Integrar Diagnostics Hooks

### No componente:
```jsx
function MeuComponente() {
  const renderCount = useRef(0)

  if (typeof window !== 'undefined' && window.__NEXUS_DIAG__) {
    renderCount.current += 1
    traceRender('MeuComponente', { renderCount: renderCount.current })
  }
}
```

### Em efeitos:
```jsx
useEffect(() => {
  traceEffect('MeuComponente', 'loadData', 'mount')
  return () => traceEffect('MeuComponente', 'loadData', 'cleanup')
}, [])
```

---

## 8. Como Respeitar as Fases do Runtime

```jsx
function MeuFeature() {
  const { phase } = useRuntimeOrchestration()

  if (phase !== 'APP_READY') {
    // Não tente acessar dados durante bootstrap
    return <LoadingSkeleton />
  }

  return <Dados />
}
```

### Fases seguras para cada operação:

| Operação | Fase mínima |
|----------|-------------|
| Ler dados do tenant ativo | `APP_READY` |
| Mostrar UI de erro | `BOOTSTRAP_ERROR` (ou `APP_READY` com erro interno) |
| Mostrar onboarding | `APP_READY` |
| Navegação entre views | `APP_READY` |
| Trocar de tenant | Qualquer (sincronizado via orquestrador) |
| Logout | Qualquer |

---

## 9. Boas Práticas com Suspense/Lazy

```jsx
// ✅ Correto: lazyWithRetry com cacheKey
const FinanceView = lazyWithRetry(() => import('./FinanceView.jsx'), 'finance')

// ✅ Correto: ViewErrorBoundary envolvendo lazy routes
<ViewErrorBoundary areaLabel="Finanças" resetKey={someKey}>
  <Suspense fallback={<LoadingSkeleton />}>
    <FinanceView />
  </Suspense>
</ViewErrorBoundary>
```

### Regras:
1. Toda lazy route **deve** usar `lazyWithRetry` (nunca `React.lazy` direto)
2. Toda lazy route **deve** ter `ViewErrorBoundary` + `Suspense`
3. `cacheKey` deve ser única por chunk

---

## 10. Anti-Patterns

| Anti-pattern | Por que é problema | Alternativa |
|-------------|-------------------|-------------|
| `getRequiredActiveTenantId()` em hooks | Cria dependência oculta que pode quebrar com tenant switch | Receber `tenantId` como parâmetro |
| `fetch()` sem `AbortController` | setState após unmount | Usar `authenticatedFetch` ou `AbortController` próprio |
| `React.lazy()` sem `lazyWithRetry` | Chunk error quebra o app sem recovery | Usar `lazyWithRetry` |
| Ignorar `requestId` no reducer | Estado inconsistente com respostas fora de ordem | Sempre checar `requestId` |
| `useEffect` sem cleanup | Memory leak, duplicate requests | Sempre retornar cleanup |
| Mutar estado do runtime diretamente | Fases inconsistentes, debug impossível | Usar dispatch do orquestrador |
| `startTransition()` sem `completeTransition()` | Transição fantasma | Sempre parear start/complete |
| Confiar em `window.__NEXUS_DIAG__` em produção | Performance impact desnecessário | Usar event buffer para produção |
