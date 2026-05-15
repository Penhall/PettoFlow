# PHASE_34C_ENCODING_CONTENT_AND_UX_CONSISTENCY_AUDIT

Scope: NexusCRM / PettoFlow repository  
Objective: content coherence, UX semantics, encoding integrity, error-message governance, and i18n readiness.

## 1. Executive Assessment

The product is not content-coherent yet. The main UI mostly speaks PT-BR, but it does so through scattered hardcoded strings, inconsistent product vocabulary, mixed technical/admin terminology, and raw backend error propagation. There is also confirmed mojibake in an active user-facing workspace bootstrap error in `src/App.jsx`, not only in historical documentation.

Highest-risk finding: the app lacks a content boundary. UI copy, operational labels, API fallback messages, raw Supabase messages, Telegram bot replies, admin labels, theme names, route labels, and error diagnostics are all authored inline across React components, hooks, client API wrappers, and Edge Functions. That makes copy drift likely and i18n migration expensive.

The active product name is also split. `NexusCRM` is used in auth, shell, loading, error boundaries, README, and onboarding. `PettoFlow` remains in Supabase Telegram NLP prompts, finance SQL/module history, theme localStorage key, docs/plans, and repository naming. This creates a visible product-identity risk in user-facing bot flows and support/debug contexts.

## 2. Encoding Corruption Inventory

Confirmed mojibake patterns were found with targeted search for sequences such as `Ã£`, `Ã¡`, `Ã§`, `Ã³`, and replacement-marker families. Active impact exists in source:

| File | Lines | Status | Corrupted text | Affected flow |
| --- | ---: | --- | --- | --- |
| `src/App.jsx` | 759-760 | Active UI | `NÃ£o foi possÃ­vel carregar o espaÃ§o de trabalho`; `inicializaÃ§Ã£o`; `Ã¡rea` | Workspace bootstrap failure empty state |
| `docs/PHASE_11_PREMIUM_SHELL_INTEGRATION.md` | 112 | Historical docs | `repositÃ³rio` | Documentation only |
| `docs/PHASE_12_LEGACY_SHELL_CLEANUP.md` | 9, 84 | Historical docs | `repositÃ³rio` | Documentation only |
| `docs/PHASE_13_CONSERVATIVE_LEGACY_CLEANUP.md` | 11, 92 | Historical docs | `repositÃ³rio` | Documentation only |

Active persistence impact is low: the confirmed runtime corruption is a literal in the React render path, not persisted database content. However, it is user-visible during one of the most sensitive recovery moments: a failed workspace bootstrap.

Repository-wide search also shows many correct Portuguese uppercase words such as `NÃO` and `DINÂMICAS`; these are not corruption. The actionable corruption inventory is limited to mojibake sequences above.

## 3. Root-Cause Analysis

The corruption pattern is classic UTF-8 decoded as Latin1/Windows-1252 and then committed as source text. The corrupted source in `src/App.jsx` is localized to a small block, which suggests a manual paste or editor/session encoding mismatch rather than a systemic build pipeline issue.

Documentation corruption appears in older phase reports and uses the same pattern. This indicates multiple historical edits or generated reports were introduced with inconsistent encoding handling. Because current files also contain valid Portuguese accents elsewhere, the repository is capable of UTF-8, but it has no automated guard against mojibake.

Recommended guardrails:

- Add a CI grep/check for known mojibake sequences in active source and docs.
- Require UTF-8 editor settings in contributor docs.
- Treat copy paste from external tools as suspect until scanned.

## 4. Hardcoded-String Inventory

Hardcoded copy is pervasive. A broad literal scan outside tests and CSS found approximately 194 active source/function files with string literals and about 5,677 literal occurrences across `src` and `supabase/functions`. Not all are UI copy, but the volume confirms there is no enforced content layer.

Primary hardcoded-string zones:

| Area | Examples | Risk |
| --- | --- | --- |
| Shell/navigation | `src/components/shell/SidebarRail.jsx` has `Dashboard`, `Tarefas`, `Finanças`, `Gestão SaaS`, admin labels | Labels duplicated with route IDs and admin semantics |
| Loading states | `src/App.jsx`, `DeferredSurface.jsx`, module pages use many independent `Carregando...` variants | Inconsistent specificity and accent quality |
| Empty states | `EmptyState` is reusable, but copy is passed inline throughout feature pages | Semantics depend on each caller |
| API clients | `workspaceCore.js`, `tenantApi.js`, `memberApi.js`, `billingApi.js`, `adminApi.js`, `botConfig.js`, `onboardingApi.js` | Error copy duplicated and mixed with transport logic |
| Backend functions | `workspace-core`, `tenant-core`, `admin-core`, `invite-member`, bot functions | Backend messages can become UI copy |
| Admin surfaces | `TenantsPage.jsx`, `AdminDashboard.jsx`, `AuditPage.jsx`, `PlansPage.jsx` | Mixed business/user/internal terminology |
| Legacy components | `src/components/Dashboard.jsx`, `src/components/Clientes.jsx`, `src/components/Time.jsx` | Old component copy remains in repo and may drift |
| Bot/Telegram | `supabase/functions/telegram-webhook/*`, `bot-commands` | User-facing bot copy lives outside frontend conventions |

There are partial local content maps, but they are component-scoped rather than product-scoped: `TAB_LOADING_LABELS`, `TAB_ERROR_LABELS`, `ROLE_LABELS`, `TYPE_LABELS`, `GROUP_LABELS`, `TOUR_STEPS`, `QUICK_ACTIONS`, and finance/activity label maps. These reduce duplication inside a file but do not provide a content system.

## 5. Mixed-Language-Flow Analysis

The product is mostly PT-BR in visible copy, but English leaks in several active paths:

- Developer/runtime diagnostics: `Error fetching workspace data`, `Error adding task`, `ChunkLoadError`, `Strict ownership violation`, `Internal server error`, `Method not allowed`.
- Backend auth/errors: `Unauthorized` in `_shared/auth.ts` and `notification-worker/index.ts`; `Internal server error` in multiple Edge Functions.
- Admin domain language: `tenant`, `workspace`, `cliente`, `espaço de trabalho`, `SaaS`, `billing`, `MRR`, and `checkout` coexist.
- Theme/content drift: `Claro Premium`, `Noturno Premium`, `Clássico SaaS`, `Twenty (Grafite)`.
- Bot/NLP: the Telegram NLP prompt says `PettoFlow`, while the user-facing app shell/auth says `NexusCRM`.

Some English is acceptable for logs and code-level diagnostics, but the current system does not reliably separate diagnostic language from UI language. Because frontend wrappers throw `data?.error` directly, backend English can appear in UI error banners.

## 6. UX Semantic Consistency Assessment

Loading semantics are inconsistent:

- Global startup says `Carregando NexusCRM...`.
- Tenant gate says `Carregando espaços de trabalho do NexusCRM...`.
- Suspense fallbacks say `Carregando dashboard...`, `Carregando tenants...`, `Carregando área...`.
- `DeferredSurface` defaults to unaccented `Carregando area...`.
- Some pages use bare paragraphs like `Carregando...`, while others use full empty-state surfaces.

Retry semantics are also inconsistent:

- `ViewErrorBoundary` uses `Tentar novamente` for render errors and `Recarregar pagina` for chunk errors, with missing accents in several strings.
- `RootErrorBoundary` uses both `Recarregar página` and `Tentar novamente`.
- Bootstrap error uses `Tentar novamente`.
- Some feature failures use `alert(...)`, which breaks the app's surface-based UX model.

Empty states are structurally better than errors because `EmptyState` exists and many feature pages use it. However, copy tone varies between operational/product language and plain status language. Examples include dense operational copy like `camada operacional`, plain state copy like `Nenhum cliente encontrado`, and admin/system terms like `Nenhum tenant criado ainda`.

Action naming is not normalized. Examples include `Criar tarefa`, `Nova Tarefa`, `Criar primeira tarefa`, `Novo cliente`, `Salvar cliente`, `Criar Transação`, `Criar conta`, and `Salvar Regra`. Capitalization and verb pattern vary by component.

## 7. Error-Message-Governance Findings

There is no centralized error-message governance.

Critical patterns:

- `workspace-core/index.ts` returns `{ error: error.message }` on many Supabase failures. These messages can include database terms, constraint names, RLS details, or English provider messages.
- `tenant-core`, `admin-core`, and `invite-member` frequently call `ctx.fail(..., error.message)`.
- Client parse helpers throw `new Error(data?.error ?? fallbackMessage...)`, which prioritizes backend/raw messages over normalized user copy.
- Many components call `setError(err.message)` directly, including settings, admin, Telegram, command forms, billing, file upload, and claim-master surfaces.
- Several user-visible flows still use `alert(...)`: task create/update, Kanban column create, finance billing action, missing account warnings, logout, and event detail flows.
- Diagnostics are generally gated to console or dev details in `RootErrorBoundary`, which is good, but raw async messages are still recorded and sometimes rendered upstream.

Recommended governance split:

- User-facing: stable PT-BR message by error code and surface.
- Diagnostic-only: raw `error.message`, provider body, stack, SQL/constraint detail, request stage, tenant ID, and runtime phase.
- API contract: Edge Functions should return `{ code, message }`, where `message` is safe and localized only if the backend owns that surface. Otherwise the frontend should map `code`.

## 8. Legacy-Content Drift Findings

Product naming drift:

- `NexusCRM` is active in auth, shell, loading, README, root error boundary, dashboard welcome, tenant gate, and admin claim surfaces.
- `PettoFlow` remains active in `supabase/functions/telegram-webhook/parser/nlp.ts`, SQL comments/plans, localStorage key `pettoflow_theme`, docs/plans, and repository paths.
- Some docs explicitly describe `NexusCRM / PettoFlow`, confirming this is an unresolved rename/migration boundary.

Terminology drift:

- `tenant` appears as a user/admin term in admin pages: `Total de Tenants`, `Tenants Ativos`, `Últimos Tenants`, `Nenhum tenant criado ainda`.
- The same concept is rendered as `cliente` in the admin tenant list: `Carregando clientes...`, title `Clientes`, subtitle `Gerencie clientes, planos e acesso à plataforma`.
- End-user areas use `espaço de trabalho` for tenant, while admin surfaces use `tenant`, `cliente`, and `plataforma` interchangeably.
- `workspace` appears inside PT-BR copy in the corrupted bootstrap block and tutorial catalog.
- `premium`, `classic`, `SaaS`, and `Twenty` remain in theme names and docs, but the product's visible design system now speaks operational/workspace language.

Legacy files still present at `src/components/Dashboard.jsx`, `src/components/Clientes.jsx`, and `src/components/Time.jsx` contain old page-level copy. They are not the active premium pages, but their presence increases future import risk and audit noise.

## 9. I18n-Readiness Assessment

The product is not structurally ready for i18n.

Current readiness strengths:

- React components are plain and easy to refactor incrementally.
- Some labels are already isolated in local constants.
- Dates/currency mostly use `pt-BR` Intl formatting in admin/billing areas.
- Reusable primitives exist for `EmptyState`, `PageHeader`, `PageTabs`, and `DeferredSurface`.

Readiness gaps:

- No translation dependency or app-level translation provider.
- No message catalogs.
- No product glossary.
- No route/content key strategy.
- UI copy is embedded in JSX, hooks, API wrappers, and Edge Functions.
- Backend errors are transported as display strings.
- Tests assert literal Portuguese strings in many places, which will make migration noisy.
- Bot copy and web app copy are separate systems.

Migration cost is medium-high. It is not blocked by architecture, but it requires a content-governance phase before an i18n implementation. Implementing i18n directly now would preserve existing inconsistency under translation keys.

## 10. Highest-Priority UX/Content Risks

1. User-facing mojibake in workspace bootstrap failure.
2. Raw backend/Supabase errors can leak directly into UI.
3. Product identity split between `NexusCRM` and `PettoFlow`.
4. Admin surfaces confuse `tenant`, `cliente`, and `espaço de trabalho`.
5. Action labels and capitalization are inconsistent across modules.
6. Loading/retry/error surfaces vary between polished primitives, bare paragraphs, and browser alerts.
7. Bot copy is not governed with the web app copy.
8. Legacy components and historical docs preserve outdated terminology.
9. No content layer, glossary, or i18n boundary exists.
10. Tests lock in current string drift, making future cleanup more expensive.

## 11. Recommended Convergence Roadmap

### Step 1: Stop New Drift

- Add a mojibake scan to lint/CI for active source and docs.
- Define a short product glossary: product name, workspace, tenant/admin tenant, customer/client, billing/faturamento, plan/plano, retry/reload language.
- Decide whether public brand is `NexusCRM` or `PettoFlow`; document exceptions such as repository/package/internal keys.

### Step 2: Normalize Error Boundaries

- Replace active mojibake in `src/App.jsx`.
- Create a frontend error normalizer that maps API `code` to safe PT-BR copy.
- Change client API wrappers to prefer normalized code/fallback over raw `data.error`.
- Keep raw backend/provider messages in diagnostics only.
- Replace `alert(...)` with app-native inline/toast/banner patterns.

### Step 3: Consolidate Surface Copy

- Create a non-i18n content module first, grouped by surface: shell, auth, workspace, tasks, clients, finance, calendar, settings, admin, billing, bot.
- Move route labels, loading labels, empty-state copy, and action labels into that module.
- Normalize capitalization and verbs: choose `Novo/Nova` vs `Criar`, `Salvar` vs `Atualizar`, `Recarregar página` vs `Tentar novamente`.

### Step 4: Resolve Admin Terminology

- Keep `tenant` as internal/API terminology.
- Use either `workspace`/`espaço de trabalho` or `cliente da plataforma` in admin UI, not both in the same flow.
- Rename admin tenant page labels consistently: navigation, page title, loading, empty state, table headings, and metrics.

### Step 5: Prepare i18n Without Implementing It Yet

- After content convergence, introduce stable message keys in the content module.
- Adjust tests to assert roles/behavior where possible and only assert key user-facing strings intentionally.
- Keep Edge Function responses code-first.
- Later, replace the content module with an actual i18n catalog/provider when business need requires it.

## Audit Verdict

Phase 34C should be considered failed for full content coherence, with one active encoding defect and multiple governance gaps. The product is usable and largely PT-BR, but it does not yet speak with one controlled voice. The next work should be convergence and normalization, not immediate i18n implementation.
