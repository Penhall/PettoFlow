# Investigação: impacto dos tutoriais no fluxo do app

## Contexto

O projeto é um CRM/SaaS (PettoFlow/NexusCRM). Recentemente (commit `0a00814`) foi implementada a Fase 21 — painel de onboarding, tour guiado e central de tutoriais. Suspeita-se que essa fase introduziu rotinas que interferem negativamente no funcionamento correto do app.

## O que investigar

### 1. Tour auto-aberto — `src/App.jsx` (linhas 283-303)

```javascript
useEffect(() => {
    if (!activeTenantId || onboarding.loading || tourAutoPrompted) return
    if (activeTab !== 'dashboard') return

    const status = onboarding.state.tourState?.status || 'not_started'
    const lastStep = Number(onboarding.state.tourState?.last_step || 0)

    if (status === 'not_started') {
      setTourStepIndex(lastStep)
      setTourOpen(true)
      setTourAutoPrompted(true)
      void onboarding.updateTourState(...)
    }
  }, [activeTenantId, activeTab, onboarding, tourAutoPrompted])
```

**Problema suspeito:** `onboarding` é um objeto — muda de referência a cada render do hook `useOnboarding`, pois `useOnboarding` retorna `{ loading, state, ... }` (um novo objeto literal a cada chamada). Isso significa que esse useEffect pode disparar repetidamente, reabrindo o tour ou causando loops de requisição.

Também: o tour abre automaticamente na primeira vez que o usuário chega no dashboard. Isso pode ser intrusivo — o usuário quer usar o app, não ver um tour.

### 2. Seeding excessivo de tasks — `supabase/functions/_shared/onboarding.ts`

O seed original criava 3 tarefas de demonstração. A Fase 21 adicionou **6 tarefas de tutorial** (linhas 347-407), totalizando **9 tarefas** no board de um usuário novo. Isso polui o Kanban com tarefas que parecem "reais" (têm `origin_type: 'onboarding_seed'` como as demais) mas são na verdade checklist de onboarding.

Lista das 6 tarefas tutorial seeded:
- 📋 Explore o Kanban — arraste tarefas entre colunas
- 📅 Agende uma atividade no Calendário
- 🤖 Conecte o Bot do Telegram
- 👥 Convide um membro para o workspace
- 💰 Registre uma transação financeira
- ✅ Complete o tour de onboarding

**Problema suspeito:** Essas tarefas não são acionáveis no contexto real do app (algumas dependem de features que podem não estar disponíveis). Elas poluem o board e podem confundir o usuário sobre o que é "demo" vs "real". Além disso, o checklist de onboarding pede "Criar a primeira tarefa real" — mas já existem 9 tarefas no board.

### 3. Dependência frágil — `onboarding` como objeto no useEffect

```javascript
const onboarding = useOnboarding({ tenantId: activeTenantId, enabled: Boolean(activeTenantId) })
```

O hook `useOnboarding` (em `src/hooks/useOnboarding.js`) retorna um objeto literal novo a cada render:

```javascript
return {
    loading,
    error,
    state,
    ...
    patchState,
    emitEvent,
    completeChecklistItem,
    dismissSurface,
    markTutorialOpened,
    markTutorialCompleted,
    updateTourState,
}
```

**Problema suspeito:** Toda vez que o React re-renderiza o App, um novo objeto `onboarding` é criado. O `useEffect` que depende de `onboarding` (linha 303) vai re-executar, potencialmente reabrindo o tour ou causando chamadas de API extras.

### 4. Chamadas de API em cada aba

Em `src/App.jsx`, cada aba do app recebe props de onboarding:
- `onOpenTutorial`
- `onTrackOnboarding`
- `showHint` / `onDismissHint`

Isso significa que ao navegar para qualquer aba, callbacks de onboarding são passados. Alguns hints (como `showTimelineHint`, `showFiltersHint`) disparam verificações de estado.

**Problema suspeito:** Cada navegação entre abas potencialmente dispara verificações de estado de onboarding, aumentando latência e causando re-renders desnecessários.

### 5. O painel de onboarding no Dashboard

OnboardingPanel é mostrado no dashboard baseado em:
```javascript
const shouldShowOnboardingPanel = Boolean(
    activeTenantId &&
    !onboarding.loading &&
    !onboardingPanelDismissed &&
    checklistPreview.length
)
```

**Problema suspeito:** O painel some apenas quando o checklist inteiro é completado OU o usuário dispensa manualmente. Enquanto está visível, ocupa espaço no dashboard que poderia mostrar métricas reais. O botão de dispensar é pequeno (ícone X), fácil de ignorar.

### 6. Possível race condition no carregamento

`useOnboarding` é chamado com `enabled: Boolean(activeTenantId)`. No fluxo de login:
1. AuthContext resolve → activeTenantId fica disponível
2. useOnboarding começa a carregar (setLoading(true))
3. Ao mesmo tempo, fetchWorkspaceData também carrega
4. onboarding.loading afeta shouldShowOnboardingPanel

**Problema suspeito:** Pode haver flicker no dashboard enquanto onboarding state carrega, ou o panel aparecer/desaparecer durante a primeira renderização.

### 7. TutorialsHub como lazy route

TutorialsHub é carregado via `lazyWithRetry`:
```javascript
const TutorialsHub = lazyWithRetry(() => import('./components/onboarding/TutorialsHub.jsx'), 'tutorials-hub')
```

**Problema suspeito:** Se o chunk falhar (especialmente em deploys com hash diferentes), o `lazyWithRetry` + `ViewErrorBoundary` pode causar a tela de erro "Recarregar página" — interrompendo completamente o uso do app.

## O que queremos saber

Para cada um dos 7 pontos acima:

1. **Qual o comportamento atual?** — Leia o código e rastreie o fluxo
2. **Qual o comportamento esperado?** — O que faria mais sentido para um usuário real
3. **Qual o risco real?** — Isso está causando bugs, lentidão, ou só é ineficiente?
4. **Recomendação** — O que mudar, e qual a prioridade (critical/alta/media/baixa)

## Arquivos para analisar

- `src/App.jsx` — integração principal do onboarding
- `src/hooks/useOnboarding.js` — hook de estado de onboarding
- `src/lib/onboardingApi.js` — API calls
- `src/lib/tutorialCatalog.js` — catálogo de tutoriais e checklist
- `src/lib/onboardingState.js` — constantes de versão
- `src/components/onboarding/OnboardingPanel.jsx` — painel no dashboard
- `src/components/onboarding/OnboardingTour.jsx` — tour modal
- `src/components/onboarding/TutorialsHub.jsx` — central de tutoriais
- `supabase/functions/_shared/onboarding.ts` — Edge Function de seed de onboarding
- `src/components/Dashboard/Dashboard.jsx` — dashboard que recebe o painel

## Metodologia

1. Para cada ponto suspect, rastreie o fluxo completo: gatilho → estado → efeito colateral
2. Simule mentalmente o comportamento para um novo usuário fazendo login pela primeira vez
3. Identifique se há loops de requisição, re-renders desnecessários, ou estados inconsistentes
4. Classifique cada problema como: **bug** (comportamento incorreto), **performance** (lentidão), ou **UX** (confuso/indesejado)

## Formato do relatório

Para cada ponto investigado:

```
## Ponto N: [Título]

**Comportamento atual:** ...
**Comportamento esperado:** ...
**Código relevante:** (arquivo:linha)
**Risco:** [bug|performance|UX]
**Severidade:** [critical|alta|media|baixa]
**Recomendação:** ...
```
