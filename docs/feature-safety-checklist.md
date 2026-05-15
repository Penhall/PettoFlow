# Feature Safety Checklist

> Checklist obrigatório para toda nova feature no NexusCRM.
> Versão: 1.0 — Phase 32

---

## Como Usar

Para cada nova feature, percorra o checklist completo antes do merge.
Marque `[x]` quando validado, `[-]` quando N/A com justificativa.

---

## 1. Tenant Ownership

- [ ] A feature recebe `tenantId` como parâmetro explícito?
- [ ] `authenticatedFetch()` é usado com `{ tenantId }`?
- [ ] Hooks de dados aceitam `tenantId` (não leem de contexto)?
- [ ] Dados são refetchados quando `activeTenantId` muda?
- [ ] Cache (se houver) é invalidado na troca de tenant?
- [ ] Nenhum `getRequiredActiveTenantId()` implícito foi introduzido?

---

## 2. Orchestration Awareness

- [ ] A feature registra transições via `startTransition()`/`completeTransition()`?
- [ ] Usa `startRetry()` para operações com retry explícito?
- [ ] Reporta falhas via `traceAsyncFailure()` com tipo correto?
- [ ] Lê `phase` do `useRuntimeOrchestration()` antes de operar?
- [ ] Não assume `APP_READY` para operações que dependem de bootstrap?

---

## 3. Cancellation Safety

- [ ] `useEffect` retorna cleanup que aborta operações pendentes?
- [ ] Usa `AbortController` para operações fetch?
- [ ] Usa `active` flag para prevenir setState após unmount?
- [ ] Usa `requestId` staleness check no reducer (se aplicável)?
- [ ] `cancelTenantLoad()`/`cancelWorkspaceLoad()` disparado no cleanup?

---

## 4. Retry Safety

- [ ] Se a operação falha, o usuário pode tentar novamente?
- [ ] Retry não cria duplicação de dados ou副作用?
- [ ] Múltiplos retries rápidos são seguros (nenhum efeito colateral cumulativo)?
- [ ] O estado `RECOVERING` não conflita com outras operações?

---

## 5. Mounted-Runtime Tested

- [ ] Teste Playwright que valida transição sem crash?
- [ ] Teste que valida comportamento durante tenant switch?
- [ ] Teste que valida cancellation (navegação durante carregamento)?
- [ ] Teste que valida retry?

---

## 6. Strict Mode Compatible

- [ ] Componente não quebra com `<React.StrictMode>` (double-invoke effects)?
- [ ] `useEffect` cleanup é idempotente?
- [ ] Nenhum warning de lifecycle duplicado?
- [ ] `lazyWithRetry` usado em vez de `React.lazy`?

---

## 7. Stale Commit Safe

- [ ] `active` flag em todo `useEffect` assíncrono?
- [ ] `requestId` staleness check (se reducer-based)?
- [ ] Respostas de fetch ignoradas se componente foi desmontado?
- [ ] Nenhum `.then(setState)` sem guard?

---

## 8. Diagnostics-Aware

- [ ] `traceAsyncFailure()` chamado com tipo apropriado nos catch blocks?
- [ ] `traceRender()` ou `traceEffect()` para componentes críticos?
- [ ] `diagWarn()` para situações inesperadas não-fatais?
- [ ] Falhas são classificadas corretamente (network, auth, bootstrap, etc.)?

---

## 9. Transition-Safe

- [ ] `startTransition()` + `completeTransition()` pareados?
- [ ] `interruptTransition()` chamado se operação é abortada?
- [ ] Transições de mesmo kind não conflitam inesperadamente?
- [ ] Navegação durante transição é segura?

---

## 10. Suspense-Safe

- [ ] Lazy routes usam `lazyWithRetry()`?
- [ ] `ViewErrorBoundary` envolvendo lazy routes?
- [ ] `<Suspense fallback>` em todas as lazy routes?
- [ ] Fallback não causa layout shift severo?

---

## 11. Performance

- [ ] Nenhum rerender desnecessário introduzido?
- [ ] Dependências de `useEffect`/`useMemo` corretas?
- [ ] Nenhum provider re-montando sem necessidade?
- [ ] Lazy-loading mantido para rotas pesadas?
- [ ] Bundle size impact aceitável (verificar com `npm run build`)?

---

## 12. Release Readiness

- [ ] ESLint passando sem warnings?
- [ ] Testes unitários passando?
- [ ] Build bem-sucedido?
- [ ] Playwright tests passando (se aplicável)?
- [ ] Nenhum `console.log`/debug remnant em produção?
- [ ] Erros tratados com mensagens amigáveis em PT-BR?

---

## Anti-Patterns (FAIL se presente)

| Item | Falha |
|------|-------|
| `React.lazy` sem wrapper | ❌ REPROVADO |
| `fetch()` sem tratamento de erro | ❌ REPROVADO |
| Dados de tenant sem `tenantId` | ❌ REPROVADO |
| `useEffect` sem cleanup | ❌ REPROVADO |
| Mutação direta de estado do runtime | ❌ REPROVADO |
| Chunk sem `lazyWithRetry` | ❌ REPROVADO |
