# PettoFlow Onboarding, Tour Inicial e Central de Tutoriais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar onboarding progressivo do PettoFlow com seed inicial editavel, painel de ativacao, tour curto, central de tutoriais e empty states acionaveis sem bloquear o uso do produto.

**Architecture:** O backend passa a persistir estado de onboarding por `tenant + user`, incluindo versao, dismiss e telemetry minima, enquanto o seed inicial e aplicado no fluxo de criacao do tenant com metadata de provenance. No frontend, o shell ganha um painel de onboarding e uma central de tutoriais baseada em catalogo versionado, e as paginas operacionais passam a consumir quick actions e ajuda contextual de forma reutilizavel.

**Tech Stack:** React 18, Vite, Vitest, Supabase Edge Functions, Postgres migrations, existing premium shell primitives, lucide-react

---

## File map

### Backend / Supabase

- Create: `supabase/migrations/20260507190000_onboarding_state_and_seed_metadata.sql`
  - cria estruturas de persistencia para onboarding state e dismiss/telemetry minimo
- Create: `supabase/functions/_shared/onboarding.ts`
  - helpers de leitura, escrita e seed de onboarding
- Modify: `supabase/functions/tenant-core/index.ts`
  - aciona seed inicial na criacao do tenant e expõe endpoints de progresso

### Frontend domain

- Create: `src/lib/onboardingApi.js`
  - chamadas para ler/salvar progresso, dismiss e telemetry
- Create: `src/lib/tutorialCatalog.js`
  - catalogo versionado de tutoriais, checklists, quick actions e ids estaveis
- Create: `src/lib/onboardingState.js`
  - constantes de versao, experience stages e mapeamentos compartilhados
- Create: `src/hooks/useOnboarding.js`
  - estado consolidado do onboarding por tenant/usuario

### Frontend UI

- Create: `src/components/onboarding/OnboardingPanel.jsx`
  - checklist inicial e progresso
- Create: `src/components/onboarding/OnboardingTour.jsx`
  - tour curto e retomavel
- Create: `src/components/onboarding/TutorialsHub.jsx`
  - pagina da central de tutoriais com busca e categorias
- Create: `src/components/onboarding/TutorialCard.jsx`
  - card de tutorial reutilizavel
- Create: `src/components/onboarding/ContextualHint.jsx`
  - hint com dismiss persistente
- Create: `src/components/onboarding/QuickActionsRow.jsx`
  - linha reutilizavel de quick actions
- Modify: `src/components/shared/EmptyState.jsx`
  - suporte nativo a quick actions e CTA de tutorial
- Modify: `src/components/shell/SidebarRail.jsx`
  - entrada para central de tutoriais
- Modify: `src/components/shell/ProfileMenu.jsx`
  - acao de reabrir tour / ajuda
- Modify: `src/App.jsx`
  - integra painel, rota de tutoriais, hooks e telemetry basica
- Modify: `src/components/tenant/WorkspaceOnboarding.jsx`
  - opcao futura compatível com initialization mode

### Pages likely needing onboarding integration

- Modify: `src/components/Tasks/TasksPage.jsx`
- Modify: `src/components/Activities/ActivitiesView.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`
- Modify: `src/components/Clients/ClientesView.jsx`
- Modify: `src/components/Team/TimeView.jsx`
- Modify: `src/components/Calendar/CalendarWorkspacePage.jsx`
- Modify: `src/components/Archive/ArchiveView.jsx`
- Modify: `src/components/Settings/SettingsView.jsx`

### Tests

- Create: `src/hooks/useOnboarding.test.jsx`
- Create: `src/lib/tutorialCatalog.test.js`
- Create: `src/components/onboarding/OnboardingPanel.test.jsx`
- Create: `src/components/onboarding/TutorialsHub.test.jsx`
- Modify: `src/context/TenantContext.test.jsx`
- Modify: `src/components/tenant/TenantGate.test.jsx`
- Modify: `src/components/Tasks/TasksPage.test.jsx`
- Modify: `src/components/Finance/FinanceView.test.jsx`
- Modify: `src/components/Clients/ClientesView.test.jsx`

### Reporting

- Create: `docs/PHASE_20_ONBOARDING_FOUNDATION_REPORT.md`
- Create: `docs/PHASE_21_ONBOARDING_PANEL_AND_TOUR_REPORT.md`
- Create: `docs/PHASE_22_EMPTY_STATES_AND_TUTORIALS_REPORT.md`
- Create: `docs/PHASE_23_ONBOARDING_HARDENING_REPORT.md`

---

### Task 1: Create backend onboarding foundation and seed provenance

**Files:**
- Create: `supabase/migrations/20260507190000_onboarding_state_and_seed_metadata.sql`
- Create: `supabase/functions/_shared/onboarding.ts`
- Modify: `supabase/functions/tenant-core/index.ts`
- Test: `npm.cmd run test:deno` if shared function tests are extended later; otherwise verify via frontend tests + build in this repo phase

- [ ] **Step 1: Write the failing migration-aware contract test in frontend domain**

Add a new API-facing test file to lock the payload contract before implementation:

```js
import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingVersion } from './onboardingState.js'

describe('onboarding state contract', () => {
  it('defines stable default version and experience levels', () => {
    expect(getDefaultOnboardingVersion()).toBe('2026.05')
  })
})
```

Run: `npx.cmd vitest run src/lib/tutorialCatalog.test.js`
Expected: FAIL because `onboardingState.js` and the contract do not exist yet.

- [ ] **Step 2: Add the migration for onboarding state, dismiss state, telemetry and provenance-ready columns**

Create the migration with minimal normalized tables instead of overloading `tenant_settings`:

```sql
create table if not exists public.tenant_onboarding_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_onboarding_version text not null,
  completed_onboarding_version text,
  last_seen_onboarding_version text,
  experience_level text not null default 'new',
  tour_state jsonb not null default '{}'::jsonb,
  checklist_state jsonb not null default '{}'::jsonb,
  tutorial_state jsonb not null default '{}'::jsonb,
  dismiss_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.tenant_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Also add provenance columns to seedable operational tables that are safe to extend now, using nullable metadata:

```sql
alter table public.tasks add column if not exists origin_type text;
alter table public.tasks add column if not exists origin_version text;
alter table public.tasks add column if not exists seed_batch_id text;
alter table public.tasks add column if not exists created_by_system boolean not null default false;
```

Repeat the same pattern for the seed-target tables that are actually used in the implementation (`clients`, `activities`, `transactions` or equivalent financial table used by this app).

- [ ] **Step 3: Add shared onboarding helpers in Supabase Edge functions**

Create `supabase/functions/_shared/onboarding.ts` with focused helpers:

```ts
export const CURRENT_ONBOARDING_VERSION = '2026.05'

export function buildSeedMetadata(originType: string, seedBatchId: string) {
  return {
    origin_type: originType,
    origin_version: CURRENT_ONBOARDING_VERSION,
    seed_batch_id: seedBatchId,
    created_by_system: true,
  }
}
```

Also add:

- `ensureTenantOnboardingState(...)`
- `recordOnboardingEvent(...)`
- `seedTenantOnboardingData(...)`

Keep the seed idempotent by first checking if the tenant already has a recorded seed batch or seeded profile key in `tenant_settings`.

- [ ] **Step 4: Wire tenant creation to seed onboarding data and initialize state**

Modify `supabase/functions/tenant-core/index.ts` in the tenant creation branch after membership/settings creation:

```ts
const seedBatchId = crypto.randomUUID()
await ensureTenantOnboardingState({
  sb,
  tenantId: String(tenant.id),
  userId: auth.user.id,
})
await seedTenantOnboardingData({
  sb,
  tenantId: String(tenant.id),
  userId: auth.user.id,
  tenantName: String(tenant.name),
  seedBatchId,
})
await recordOnboardingEvent({
  sb,
  tenantId: String(tenant.id),
  userId: auth.user.id,
  eventName: 'onboarding_started',
})
```

Return lightweight onboarding metadata in the `POST /tenants` response:

```ts
onboarding: {
  currentVersion: CURRENT_ONBOARDING_VERSION,
  initializationMode: 'guided_seeded',
}
```

- [ ] **Step 5: Expose tenant onboarding endpoints**

Still inside `tenant-core`, add routes:

- `GET /tenants/:id/onboarding`
- `PATCH /tenants/:id/onboarding`
- `POST /tenants/:id/onboarding/events`

PATCH payload should support:

```json
{
  "tourState": {},
  "checklistState": {},
  "tutorialState": {},
  "dismissState": {},
  "experienceLevel": "learning",
  "lastSeenOnboardingVersion": "2026.05"
}
```

- [ ] **Step 6: Run verification for the backend foundation**

Run:

- `npm.cmd run lint`
- `npm.cmd run build`

Expected:

- lint PASS
- build PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260507190000_onboarding_state_and_seed_metadata.sql supabase/functions/_shared/onboarding.ts supabase/functions/tenant-core/index.ts src/lib/onboardingState.js src/lib/tutorialCatalog.test.js
git commit -m "feat(onboarding): add backend onboarding foundation"
```

---

### Task 2: Add frontend onboarding domain, catalog and state hook

**Files:**
- Create: `src/lib/onboardingState.js`
- Create: `src/lib/tutorialCatalog.js`
- Create: `src/lib/onboardingApi.js`
- Create: `src/hooks/useOnboarding.js`
- Create: `src/lib/tutorialCatalog.test.js`
- Create: `src/hooks/useOnboarding.test.jsx`

- [ ] **Step 1: Write the failing catalog and hook tests**

Create `src/lib/tutorialCatalog.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { TUTORIAL_CATALOG, ONBOARDING_CHECKLIST } from './tutorialCatalog.js'

describe('tutorialCatalog', () => {
  it('defines stable tutorial ids and quick actions', () => {
    expect(TUTORIAL_CATALOG.find((item) => item.id === 'getting-started.clients')).toBeTruthy()
    expect(ONBOARDING_CHECKLIST.find((item) => item.id === 'create-first-client')).toBeTruthy()
  })
})
```

Create `src/hooks/useOnboarding.test.jsx`:

```jsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOnboarding } from './useOnboarding.js'

vi.mock('../lib/onboardingApi.js', () => ({
  getOnboardingState: vi.fn(async () => ({ currentOnboardingVersion: '2026.05' })),
}))

describe('useOnboarding', () => {
  it('loads onboarding state for the active tenant', async () => {
    const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.currentOnboardingVersion).toBe('2026.05')
  })
})
```

Run: `npx.cmd vitest run src/lib/tutorialCatalog.test.js src/hooks/useOnboarding.test.jsx`
Expected: FAIL because the modules do not exist yet.

- [ ] **Step 2: Implement shared onboarding constants**

Create `src/lib/onboardingState.js`:

```js
export const CURRENT_ONBOARDING_VERSION = '2026.05'
export const EXPERIENCE_LEVELS = ['new', 'learning', 'operational', 'advanced', 'power_user']
export const INITIALIZATION_MODES = ['guided_seeded', 'clean_workspace', 'future_demo_workspace', 'future_imported_workspace']

export function getDefaultOnboardingVersion() {
  return CURRENT_ONBOARDING_VERSION
}
```

- [ ] **Step 3: Implement the tutorial and checklist catalog**

Create `src/lib/tutorialCatalog.js` with stable ids and explicit relationships:

```js
export const TUTORIAL_CATALOG = [
  {
    id: 'getting-started.clients',
    title: 'Cadastrar o primeiro cliente real',
    category: 'Primeiros passos',
    owner_module: 'clientes',
    feature_dependency: 'clientes',
    minimum_version: '2026.05',
    quickActionIds: ['create-client'],
  },
]

export const ONBOARDING_CHECKLIST = [
  {
    id: 'create-first-client',
    tutorialId: 'getting-started.clients',
    ctaTarget: 'clientes',
  },
]
```

Also export `QUICK_ACTIONS`, `EMPTY_STATE_LINKS`, and lookup helpers by module.

- [ ] **Step 4: Implement the onboarding API client**

Create `src/lib/onboardingApi.js`:

```js
import { authenticatedFetch } from './apiFetch.js'

const TENANT_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tenant-core`

export async function getOnboardingState(tenantId) {
  const res = await authenticatedFetch(`${TENANT_CORE_URL}/tenants/${tenantId}/onboarding`, {
    method: 'GET',
    tenantId,
    requireTenant: true,
  })
  return res.json()
}
```

Add `updateOnboardingState(tenantId, payload)` and `recordOnboardingEvent(tenantId, eventName, payload)`.

- [ ] **Step 5: Implement the consolidated onboarding hook**

Create `src/hooks/useOnboarding.js`:

```js
import { useEffect, useMemo, useState } from 'react'
import { getOnboardingState, updateOnboardingState, recordOnboardingEvent } from '../lib/onboardingApi.js'
import { CURRENT_ONBOARDING_VERSION } from '../lib/onboardingState.js'
import { ONBOARDING_CHECKLIST, TUTORIAL_CATALOG } from '../lib/tutorialCatalog.js'

export function useOnboarding({ tenantId, enabled = true }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled && tenantId))
  // ...
}
```

Responsibilities:

- load persisted onboarding state
- derive checklist progress
- update dismiss state
- emit lightweight telemetry
- expose helpers like `completeChecklistItem`, `dismissSurface`, `markTutorialOpened`

- [ ] **Step 6: Re-run the focused tests**

Run: `npx.cmd vitest run src/lib/tutorialCatalog.test.js src/hooks/useOnboarding.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/onboardingState.js src/lib/tutorialCatalog.js src/lib/onboardingApi.js src/hooks/useOnboarding.js src/lib/tutorialCatalog.test.js src/hooks/useOnboarding.test.jsx
git commit -m "feat(onboarding): add frontend onboarding domain"
```

---

### Task 3: Build onboarding panel, tour shell integration and tutorials hub

**Files:**
- Create: `src/components/onboarding/OnboardingPanel.jsx`
- Create: `src/components/onboarding/OnboardingTour.jsx`
- Create: `src/components/onboarding/TutorialsHub.jsx`
- Create: `src/components/onboarding/TutorialCard.jsx`
- Create: `src/components/onboarding/ContextualHint.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/shell/SidebarRail.jsx`
- Modify: `src/components/shell/ProfileMenu.jsx`
- Create: `src/components/onboarding/OnboardingPanel.test.jsx`
- Create: `src/components/onboarding/TutorialsHub.test.jsx`

- [ ] **Step 1: Write failing UI tests for panel and tutorials hub**

`src/components/onboarding/OnboardingPanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OnboardingPanel from './OnboardingPanel.jsx'

describe('OnboardingPanel', () => {
  it('renders checklist progress and tutorial CTA', () => {
    render(<OnboardingPanel progress={1} total={4} items={[{ id: 'a', title: 'Criar cliente' }]} />)
    expect(screen.getByText(/1 de 4/)).toBeTruthy()
    expect(screen.getByText('Criar cliente')).toBeTruthy()
  })
})
```

`src/components/onboarding/TutorialsHub.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TutorialsHub from './TutorialsHub.jsx'

describe('TutorialsHub', () => {
  it('renders search and module categories', () => {
    render(<TutorialsHub tutorials={[]} categories={['Clientes']} />)
    expect(screen.getByPlaceholderText(/buscar tutorial/i)).toBeTruthy()
    expect(screen.getByText('Clientes')).toBeTruthy()
  })
})
```

Run: `npx.cmd vitest run src/components/onboarding/OnboardingPanel.test.jsx src/components/onboarding/TutorialsHub.test.jsx`
Expected: FAIL because components do not exist yet.

- [ ] **Step 2: Implement the panel and reusable tutorial cards**

Create `OnboardingPanel.jsx` using existing premium primitives:

```jsx
import SurfaceCard from '../shared/SurfaceCard.jsx'

export default function OnboardingPanel({ progress, total, items, onOpenTutorials }) {
  return (
    <SurfaceCard className="onboarding-panel">
      <header className="onboarding-panel__header">
        <span className="page-eyebrow">Primeiros passos</span>
        <h2>{progress} de {total} etapas concluídas</h2>
      </header>
    </SurfaceCard>
  )
}
```

Also create `TutorialCard.jsx` and `ContextualHint.jsx` with dismiss hooks, using motion tokens instead of local transitions.

- [ ] **Step 3: Implement the tutorials hub page**

Create `TutorialsHub.jsx` with:

- header + subtitle
- local search input
- category pills
- cards with CTA into real app areas
- progress badges

Use catalog lookups instead of local hardcoding.

- [ ] **Step 4: Integrate onboarding into the shell and app routing**

Modify `src/App.jsx`:

- add new tab id `ajuda` or `tutoriais`
- mount `useOnboarding({ tenantId: activeTenantId, enabled: Boolean(activeTenantId) })`
- show `OnboardingPanel` on `dashboard`
- mount `OnboardingTour` once the shell is ready

Example integration:

```jsx
const TutorialsHub = lazyWithRetry(() => import('./components/onboarding/TutorialsHub.jsx'), 'tutorials-hub')
```

Update `SidebarRail.jsx` nav items:

```js
{ id: 'tutoriais', label: 'Tutoriais', icon: LifeBuoy }
```

Update `ProfileMenu.jsx` to include:

- `Abrir tour`
- `Abrir central de tutoriais`

- [ ] **Step 5: Record onboarding/tour interactions**

When the tour starts, skips or completes, call `recordOnboardingEvent(...)` with:

```js
await recordOnboardingEvent(activeTenantId, 'tour_completed', { stepCount: 7 })
```

Also update persisted `tourState`.

- [ ] **Step 6: Re-run the focused UI tests**

Run:

- `npx.cmd vitest run src/components/onboarding/OnboardingPanel.test.jsx src/components/onboarding/TutorialsHub.test.jsx`
- `npm.cmd run lint`

Expected:

- both test files PASS
- lint PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/onboarding src/App.jsx src/components/shell/SidebarRail.jsx src/components/shell/ProfileMenu.jsx
git commit -m "feat(onboarding): add panel tour and tutorials hub"
```

---

### Task 4: Connect premium empty states, quick actions and contextual hints

**Files:**
- Create: `src/components/onboarding/QuickActionsRow.jsx`
- Modify: `src/components/shared/EmptyState.jsx`
- Modify: `src/components/Tasks/TasksPage.jsx`
- Modify: `src/components/Activities/ActivitiesView.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`
- Modify: `src/components/Clients/ClientesView.jsx`
- Modify: `src/components/Team/TimeView.jsx`
- Modify: `src/components/Calendar/CalendarWorkspacePage.jsx`
- Modify: `src/components/Archive/ArchiveView.jsx`
- Modify: `src/components/Settings/SettingsView.jsx`
- Modify: `src/components/Tasks/TasksPage.test.jsx`
- Modify: `src/components/Finance/FinanceView.test.jsx`
- Modify: `src/components/Clients/ClientesView.test.jsx`

- [ ] **Step 1: Write failing tests for quick actions on empty states**

Extend `TasksPage.test.jsx` or add a focused empty-state assertion:

```jsx
expect(screen.getByRole('button', { name: /criar primeira tarefa/i })).toBeTruthy()
expect(screen.getByRole('button', { name: /abrir tutorial/i })).toBeTruthy()
```

Run: `npx.cmd vitest run src/components/Tasks/TasksPage.test.jsx src/components/Finance/FinanceView.test.jsx src/components/Clients/ClientesView.test.jsx`
Expected: FAIL because the quick action buttons are not rendered yet.

- [ ] **Step 2: Extend the shared EmptyState primitive**

Modify `src/components/shared/EmptyState.jsx` to support:

```jsx
export default function EmptyState({
  quickActions = [],
  tutorialAction = null,
  ...
}) {
  // render QuickActionsRow below description and above footer action
}
```

Add `QuickActionsRow.jsx`:

```jsx
export default function QuickActionsRow({ actions }) {
  return (
    <div className="quick-actions-row">
      {actions.map((action) => (
        <button key={action.id} type="button" className="quick-actions-row__item" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Connect each critical page to onboarding-aware empty states**

For each target page:

- use the module mapping from `tutorialCatalog.js`
- wire primary quick action
- wire secondary tutorial CTA
- emit `empty_state_cta_clicked` or `quick_action_triggered`

Example in `ClientesView.jsx`:

```jsx
<EmptyState
  title="Nenhum cliente cadastrado"
  description="Clientes organizam relacionamento, histórico e próximas ações."
  detail="Esta área está vazia porque você ainda não registrou um cliente real."
  quickActions={[
    { id: 'create-client', label: 'Criar cliente', onClick: openClientModal },
    { id: 'tutorial-client', label: 'Abrir tutorial', onClick: () => openTutorial('getting-started.clients') },
  ]}
/>
```

- [ ] **Step 4: Add contextual hint support with persistent dismiss**

Use `ContextualHint.jsx` in selected pages where there is no full empty state but users still need guidance.

Examples:

- Finance filters section
- Settings integrations section
- Archive empty history section

Dismiss action must call:

```js
dismissSurface({ scope: 'finance.hint.first-subscription', reason: 'manual_close' })
```

- [ ] **Step 5: Re-run the page regression tests**

Run:

- `npx.cmd vitest run src/components/Tasks/TasksPage.test.jsx src/components/Finance/FinanceView.test.jsx src/components/Clients/ClientesView.test.jsx`
- `npm.cmd run build`

Expected:

- tests PASS
- build PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/EmptyState.jsx src/components/onboarding/QuickActionsRow.jsx src/components/Tasks/TasksPage.jsx src/components/Activities/ActivitiesView.jsx src/components/Finance/FinanceView.jsx src/components/Clients/ClientesView.jsx src/components/Team/TimeView.jsx src/components/Calendar/CalendarWorkspacePage.jsx src/components/Archive/ArchiveView.jsx src/components/Settings/SettingsView.jsx
git commit -m "feat(onboarding): connect empty states and quick actions"
```

---

### Task 5: Harden onboarding behavior, reporting and verification

**Files:**
- Modify: `src/context/TenantContext.test.jsx`
- Modify: `src/components/tenant/TenantGate.test.jsx`
- Create: `docs/PHASE_20_ONBOARDING_FOUNDATION_REPORT.md`
- Create: `docs/PHASE_21_ONBOARDING_PANEL_AND_TOUR_REPORT.md`
- Create: `docs/PHASE_22_EMPTY_STATES_AND_TUTORIALS_REPORT.md`
- Create: `docs/PHASE_23_ONBOARDING_HARDENING_REPORT.md`

- [ ] **Step 1: Add regression tests for tenant creation and onboarding fallback**

Extend `TenantContext.test.jsx` to assert onboarding metadata is preserved when a workspace is created:

```jsx
createTenantMock.mockResolvedValue({
  tenant: { id: 'tenant-1' },
  onboarding: { currentVersion: '2026.05', initializationMode: 'guided_seeded' },
})
```

Extend `TenantGate.test.jsx` to verify onboarding UI does not block app access when the onboarding state endpoint fails and the tenant already exists.

- [ ] **Step 2: Add graceful-degradation checks in the hook and shell**

Ensure `useOnboarding` falls back safely:

```js
catch (error) {
  setError(error)
  setState(buildFallbackOnboardingState())
}
```

The app must continue rendering operational pages even if:

- onboarding load fails
- tutorials catalog has filtered/deprecated items
- telemetry event write fails

- [ ] **Step 3: Create per-phase reports in docs**

Each report must include:

- nome da fase
- objetivo
- arquivos criados
- arquivos alterados
- decisoes tecnicas
- decisoes de UX/UI
- riscos encontrados
- pendencias
- proximos passos sugeridos
- evidencias de validacao
- comandos executados
- resultado de build/test/lint

Suggested content split:

- `PHASE_20` → backend foundation, seed, provenance
- `PHASE_21` → onboarding panel, tutorials hub, tour
- `PHASE_22` → empty states, quick actions, contextual hints
- `PHASE_23` → hardening, fallback, verification

- [ ] **Step 4: Run full verification**

Run:

- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`

If visual baselines were affected by shell/dashboard/help changes, also run:

- `npm.cmd run test:visual:update`
- `npm.cmd run test:visual`

Expected:

- lint PASS
- all tests PASS
- build PASS
- visual regression PASS if snapshots were intentionally updated

- [ ] **Step 5: Commit**

```bash
git add src/context/TenantContext.test.jsx src/components/tenant/TenantGate.test.jsx docs/PHASE_20_ONBOARDING_FOUNDATION_REPORT.md docs/PHASE_21_ONBOARDING_PANEL_AND_TOUR_REPORT.md docs/PHASE_22_EMPTY_STATES_AND_TUTORIALS_REPORT.md docs/PHASE_23_ONBOARDING_HARDENING_REPORT.md
git commit -m "docs: add onboarding rollout reports"
```

---

## Spec coverage check

- Seed inicial editavel: covered in Task 1 and Task 4
- Checklist persistida: covered in Task 2 and Task 3
- Tour curto e retomavel: covered in Task 3
- Central de tutoriais: covered in Task 2 and Task 3
- Empty states inteligentes: covered in Task 4
- Provenance, versionamento, dismiss, telemetry e AI-ready metadata: covered in Task 1 and Task 2
- Failure handling e comportamento nao bloqueante: covered in Task 5
- Relatorios por fase: covered in Task 5

## Notes

- Implement only the `guided_seeded` initialization mode in runtime behavior now; keep other modes as architecture flags and typed constants.
- Keep telemetry lightweight and internal to onboarding state/events for this phase.
- Do not expand into a standalone analytics dashboard or generalized CMS for tutorials.
