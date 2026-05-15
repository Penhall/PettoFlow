# Runtime Architecture Contracts

> Documento de contratos formais da arquitetura runtime do NexusCRM.
> Versão: 1.0 — Phase 32

---

## 1. Startup Lifecycle Semantics

O boot da aplicação segue uma sequência determinística de fases orquestradas:

```
BOOTSTRAP_IDLE → AUTH_HYDRATING → AUTHENTICATED → TENANT_LOADING
  → WORKSPACE_LOADING → APP_READY
```

Em caso de falha:

```
qualquer_fase → BOOTSTRAP_ERROR → (retry) → RECOVERING → (nova tentativa)
```

### Regras:
1. Cada fase **deve** ser disparada via `RuntimeOrchestrationContext`
2. Nenhuma fase pode ser pulada — a transição é linear
3. O estado `loading` do AuthContext é liberado **antes** de `syncPlatformAdmin` (deadlock prevention)
4. `BOOTSTRAP_ERROR` não é terminal — o usuário pode acionar retry
5. O estado `RECOVERING` limpa `lastError` automaticamente

---

## 2. Orchestration Phases

Definidas em `RUNTIME_PHASES` no módulo `runtimeOrchestration.js`:

| Fase | Significado | Gatilho |
|------|-------------|---------|
| `BOOTSTRAP_IDLE` | App montado, aguardando auth | `AUTH_SYNC` com `isAuthenticated: false` |
| `AUTH_HYDRATING` | AuthProvider carregando sessão | `AUTH_SYNC` com `loading: true` |
| `AUTHENTICATED` | Usuário autenticado, sem tenant | `AUTH_SYNC` com `isAuthenticated: true` |
| `TENANT_LOADING` | Carregando tenants do usuário | `TENANT_LOAD_START` |
| `WORKSPACE_LOADING` | Bootstrap do workspace ativo | `WORKSPACE_LOAD_START` |
| `APP_READY` | App pronto para interação | Resolução de workspace |
| `BOOTSTRAP_ERROR` | Falha em qualquer fase | `TENANT_LOAD_ERROR` ou `WORKSPACE_LOAD_ERROR` |
| `RECOVERING` | Retry explícito em andamento | `BOOTSTRAP_RETRY` |

### Contrato:
- A fase **nunca** deve ser setada manualmente — é sempre derivada via `deriveRuntimePhase()`
- O componente `ProtectedRoute` lê `phase` e renderiza o estado apropriado
- `RuntimeOrchestrationProvider` sincroniza `window.__NEXUS_RUNTIME_PHASE__` e `dataset.nexusRuntimePhase`

---

## 3. Ownership Propagation Rules

Todo acesso a dados de tenant **deve** carregar um `tenantId` explícito.

### Cadeia de propagação:

```
TenantContext.setActiveTenant()
  → setRuntimeActiveTenantId(activeTenantId)   // variável runtime
  → setStoredActiveTenantId(activeTenantId)    // localStorage (fallback)
  → getRequiredActiveTenantId()                // leitura: runtime > localStorage
  → workspaceCore.operation(tenantId, ...)     // parâmetro explícito
  → authenticatedFetch(url, { tenantId })      // header X-Tenant-Id
```

### Regras:
1. **Sempre** propagar `tenantId` como parâmetro explícito — nunca confiar em closure/global
2. `getRequiredActiveTenantId()` é o **último recurso**, não o padrão
3. O fallback para `localStorage` existe apenas para o race condition React 18 (child-before-parent effect order)
4. Qualquer acesso via `activeTenant.js` sem tenantId explícito gera `traceOwnership(..., 'implicit', ...)`
5. `isStrictOwnershipMode()` (flag `__NEXUS_STRICT_OWNERSHIP__`) eleva warnings para erros em dev

### Implicit access is always suspect:
- `getRequiredActiveTenantId()` sem tenantId no caller = implicit access
- Toda operação `workspaceCore` deve receber tenantId do componente/hook que a chama
- `authenticatedFetch` com `requireTenant: true` exige `tenantId` na options

---

## 4. Strict Ownership Semantics

Quando `window.__NEXUS_STRICT_OWNERSHIP__` está ativo:

1. `traceOwnership()` com `source: 'implicit'` gera **console.warn** (não apenas debug)
2. Cada `warningKey` é deduplicada via `warnedOwnershipFallbacks` Set (uma vez por operação:scope)
3. Em modo strict, ownership violations devem ser tratadas como bugs
4. Os testes `runtimeOrchestration.test.js` validam que strict ownership defaults permanecem ativos

### Modos:

| Modo | Ativação | Comportamento |
|------|----------|---------------|
| Normal | `__NEXUS_DIAG__` opcional | Implicit access logado no buffer de eventos |
| Strict | `__NEXUS_STRICT_OWNERSHIP__` | Implicit access gera warning no console |
| Diagnóstico | Ambos | Debug completo com traces de ownership |

---

## 5. Retry Semantics

O runtime suporta retry explícito para bootstrap e operações de tenant.

### Contrato:
1. `startRetry(scope, detail)` no `RuntimeOrchestrationContext` dispara `BOOTSTRAP_RETRY`
2. O estado muda para `RECOVERING`, limpando `lastError`
3. O componente de UI deve oferecer um botão de retry visível
4. `completeRetry()` apenas loga — a transição para fora de RECOVERING ocorre quando a operação subjacente resolve
5. Retries não criam loops infinitos: o usuário controla o disparo

### Limitações conhecidas:
- Não há retry automático (exponencial backoff) — retry é sempre iniciado pelo usuário
- Múltiplos retries rápidos podem causar churn no orquestrador (tracked via `transitionConflicts`)

---

## 6. Cancellation Semantics

Operações assíncronas no runtime **devem** suportar cancellation via `AbortController` ou `requestId`.

### Mecanismos:
1. **requestId tracking**: `TENANT_LOAD_START`/`WORKSPACE_LOAD_START` incrementam contadores; respostas com `requestId` obsoleto são ignoradas pelo reducer
2. **AbortController**: `authenticatedFetch()` cria controller interno com timeout de 15s + propagação de `externalSignal`
3. **Cleanup effects**: `useEffect` retorna cleanup que chama `cancelTenantLoad()` ou `controller.abort()`
4. **`active` flag**: Todo `useEffect` assíncrono usa flag `active` para evitar setState após desmontagem

### Regras:
1. Todo efeito que dispara async work **deve** retornar cleanup
2. `requestId` staleness check é obrigatório em todo resolver/error handler
3. `active` flag previne setState após unmount — mas não substitui cancellation real
4. `traceCancellation()` deve ser chamada em toda interrupção explícita

---

## 7. Mounted-Runtime Guarantees

O runtime garante que componentes permaneçam funcionais enquanto montados, mesmo durante transições.

### Garantias:
1. **Provider stability**: `RuntimeOrchestrationProvider` e `TenantContext` são montados uma vez e não remontam
2. **Key stability**: Componentes críticos usam chaves estáveis (não `activeTenantId` para evitar remounts desnecessários)
3. **Transitions**: `startTransition()`/`completeTransition()` permitem que o runtime saiba que uma transição está em andamento
4. **Transition conflicts**: Se uma transição começa enquanto outra está ativa, o conflito é registrado via `traceTransitionConflict()` e armazenado em `transitionConflicts[]`
5. **Suspense boundaries**: `ViewErrorBoundary` captura erros de chunk loading e oferece "Recarregar página"

### O que NÃO é garantido:
- Transições de tenant não preservam scroll position
- Dados não são cacheados entre switches de tenant (fresh fetch)
- Componentes que dependem de dados específicos do tenant remontam seus hooks de dados

---

## 8. Transition Interruption Rules

Transições no runtime são operações nomeadas que podem se sobrepor.

### Regras:
1. Toda transição tem `kind` (ex: `'route'`, `'tenant'`)
2. `startTransition(kind, payload)` — inicia; se já houver transição ativa do mesmo kind, registra conflito
3. `completeTransition(kind)` — finaliza normalmente
4. `interruptTransition(kind)` — interrompe abruptamente (ex: navegação durante carregamento)
5. Conflitos são armazenados em `transitionConflicts[]` (máx 25 entradas)
6. Transições de kinds diferentes não conflitam (ex: `route` + `tenant` podem coexistir)

---

## 9. Diagnostics/Tracing Expectations

O módulo `diagnostics.js` é o sistema central de observabilidade runtime.

### Gate:
- `__NEXUS_DIAG__` — ativa console.debug completo
- `__NEXUS_STRICT_OWNERSHIP__` — ativa modo strict ownership

### Funções disponíveis:

| Função | Uso | Gate |
|--------|-----|------|
| `traceRender()` | Rerenders de componentes | `__NEXUS_DIAG__` |
| `traceAsync()` | Fases de operações assíncronas | Event buffer + gate |
| `traceEffect()` | Mount/update/cleanup de effects | `__NEXUS_DIAG__` |
| `traceSuspense()` | Suspense boundaries | `__NEXUS_DIAG__` |
| `traceNavigation()` | Navegação entre rotas | `__NEXUS_DIAG__` |
| `traceOwnership()` | Acesso explícito vs implícito | Event buffer + strict gate |
| `traceAsyncFailure()` | Erros assíncronos classificados | Event buffer + gate |
| `traceOrchestrationTransition()` | Mudanças de fase do runtime | Event buffer + gate |
| `traceRetryLifecycle()` | Ciclo de retry | Event buffer + gate |
| `traceTransitionConflict()` | Conflitos de transição | Event buffer + gate |
| `traceCancellation()` | Cancelamentos | Event buffer + gate |
| `diagWarn()` | Avisos diagnósticos | Event buffer + gate |

### Event buffer:
- Armazenado em `window.__NEXUS_DIAG_EVENTS__`
- Capacidade: **250 eventos** (circular — descarta os mais antigos)
- Persiste na sessão — acessível via console para debugging
- Não persiste entre sessões

---

## 10. Async Failure Classification Rules

Erros assíncronos são classificados por tipo para diagnóstico e monitoramento.

### Tipos:
| Tipo | Origem | Ação esperada |
|------|--------|---------------|
| `unhandled-rejection` | Promise não tratada | Log + trace |
| `lazy-load-failure` | Chunk loading (lazy) | Retry + reload |
| `async-event` | Evento assíncrono inesperado | Log + trace |
| `bootstrap-failure` | Falha no bootstrap | UI de erro + retry |
| `auth-failure` | Falha de autenticação | Redirect |
| `network-failure` | Falha de rede | Log + trace |
| `onboarding-failure` | Falha no onboarding | Log + trace |
| `transition-failure` | Erro em transição | Log + recovery |

### Regra:
- Toda chamada de API assíncrona **deve** ter tratamento de erro
- `traceAsyncFailure()` deve ser chamada no catch com tipo apropriado
- Erros de chunk loading disparam `window.location.reload()` via `lazyWithRetry` (após 1 retry)

---

## 11. Tenant-Aware Feature Requirements

Qualquer feature que opera com dados **deve** ser tenant-aware.

### Checklist obrigatório:
- [ ] Operações recebem `tenantId` como parâmetro explícito
- [ ] `authenticatedFetch()` é usado com `{ tenantId }` nas options
- [ ] Hooks de dados aceitam `tenantId` (não lêem de contexto internamente)
- [ ] Componentes UI consomem `activeTenantId` do `TenantContext`
- [ ] Dados são refetchados quando `activeTenantId` muda (via useEffect com activeTenantId na dep list)
- [ ] Cache não vaza entre tenants

---

## 12. Orchestration Integration Expectations

Toda nova feature que afeta o bootstrap ou ciclo de vida **deve** integrar-se ao `RuntimeOrchestrationContext`.

### Expectativas:
1. **Registrar transições**: Use `startTransition()`/`completeTransition()` para operações longas
2. **Reportar falhas**: Use `traceAsyncFailure()` com tipo apropriado
3. **Respeitar fases**: Não assuma `APP_READY` — verifique a fase atual
4. **Suportar cancellation**: Implemente cleanup effects com `active` flag + `AbortController`
5. **Propagar tenantId**: Nunca use `getRequiredActiveTenantId()` como padrão — receba de quem chamou

---

## Appendix: Violation Examples

| Violação | Consequência | Detecção |
|----------|-------------|----------|
| Chamar API sem tenantId | Dados do tenant errado ou erro 400 | `traceOwnership('implicit')` |
| setState após unmount | Memory leak, React warning | `active` flag + ESLint react-hooks |
| Ignorar requestId staleness | Estado inconsistente | Reducer ignora stale responses |
| Não tratar erro de chunk loading | App quebrado sem recovery | `ViewErrorBoundary` + "Recarregar" |
| Usar tenantId do contexto em hook | Quebra se tenant muda durante uso | Hook aceita tenantId como parâmetro |
