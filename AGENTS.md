# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite React app. Use `src/components/` for UI, `src/hooks/` for data and state hooks, `src/lib/` for Supabase and domain helpers, and `src/context/` for shared providers. Entry points are `src/main.jsx` and `src/App.jsx`.

`supabase/functions/` contains Edge Functions and shared server utilities in `_shared/`. SQL migrations live in `supabase/migrations/`. `docs/` stores plans and design notes. `dist/` is the build output and should not be edited manually. `server/database.sqlite` is a local artifact, not the primary data model.

## Build, Test, and Development Commands
Use npm for Node workflows because this repo commits `package-lock.json`. Git usage is standard and is not restricted by the repository itself.

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally.
- `npm run lint` runs ESLint on `.js` and `.jsx` files and fails on warnings.
- `npm test` runs Vitest once for frontend/unit tests.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:deno` runs Deno tests for `supabase/functions/telegram-webhook`.

## Coding Style & Naming Conventions
Follow the existing style: ES modules, 2-space indentation, and single quotes. React components use PascalCase file names such as `FinanceView.jsx`; hooks use `useX.js`; utility modules use camelCase names such as `workspaceCore.js`.

Keep related tests beside the code when practical, using `*.test.js`, `*.test.jsx`, or `*.test.ts`. Run `npm run lint` before opening a PR.

## Testing Guidelines
Frontend tests use Vitest with Testing Library and `src/test-setup.js`. Supabase webhook tests use Deno's built-in runner. There is no enforced coverage threshold in the repo today, so add tests for changed behavior, especially parsing, auth middleware, finance rules, and calendar flows.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit prefixes like `feat(...)`, `fix(...)`, `docs:`, and focused merge summaries. Keep commits small and descriptive, for example `feat(bot-admin): auto-read config secret`.

PRs should explain user-visible impact, list validation steps, link the relevant issue or plan, and include screenshots for UI changes. Note any required env vars or migration files explicitly.

## Security & Configuration Tips
Never hardcode secrets in source. Keep frontend variables in `.env` with `VITE_` prefixes, and keep server-only secrets in Supabase function environment settings. Review SQL migrations and function auth checks together when changing workspace or Telegram access.

---

## Seções por Módulo

### Autenticação e Tenancy (AuthContext + workspaceCore)
- `src/context/AuthContext.jsx` — auth state, login/signup/logout, onAuthStateChange listener
- `src/context/TenantContext.jsx` — tenancy resolution (owned-tenancy: user dono do tenant)
- `src/lib/workspaceCore.js` — workspace resolution, OPTIONS preflight antes de createRequestContext
- `src/lib/supabaseClient.js` — Supabase client singleton
- Migration: `public.tenants`, `public.tenant_members`, `public.platform_admins`
- RPCs: `is_current_user_platform_admin()`, `is_active_member()`, `get_user_role_in_tenant()`
- Edge Function: `admin-core` com middleware `requirePlatformAdmin` em `_shared/admin.ts`

### Telegram (Bot + Webhook)
- `supabase/functions/telegram-webhook/` — Edge Function que recebe updates do Telegram
- `src/components/settings/TelegramSection.jsx` — UI de configuração do bot no workspace
- `src/components/settings/CommandsSection.jsx` — Gerenciamento de comandos slash do bot
- Tabela: `bot_configs` (tenant_id, telegram_bot_token, webhook_secret, is_active, etc.)
- Bot: @pettoflow_bot — webhook registrado na Edge Function
- Testes: `npm run test:deno` para `supabase/functions/telegram-webhook`

### Onboarding
- `src/components/onboarding/OnboardingPanel.jsx` — Painel de onboarding interativo
- `src/components/onboarding/TutorialsHub.jsx` — Central de tutoriais
- `src/components/onboarding/ContextualHint.jsx` — Dicas contextuais
- `src/hooks/useOnboarding.js` — Estado do onboarding, etapas, progresso
- Flag: `guided_tour_enabled` (feature flag)
- Testes: `useOnboarding.test.jsx`

### Finanças
- `src/components/finance/FinanceView.jsx` — View principal de finanças
- `src/components/finance/TransactionList.jsx` — Lista de transações
- `src/components/finance/TransactionForm.jsx` — Formulário de transações
- `src/hooks/useFinances.js` — Hook de finanças
- Tests: `financeRules.test.js`, `transactionalIntegrity.test.js`
- Regras de negócio em `src/lib/financeCore.js`

### Tasks (Kanban)
- `src/components/tasks/` — Kanban, Lista, Visão geral, views
- `src/components/tasks/TaskModal.jsx` — Modal de criação/edição
- 15 tarefas de seed no tenant Central (5 A Fazer, 6 Em Progresso, 4 Concluídas)

### Administração SaaS
- `src/components/admin/AdminDashboard.jsx` — Dashboard admin
- `src/components/admin/DiagnosticsPanel.jsx` — Painel de telemetria (8 grupos de contadores)
- `src/components/admin/TenantsPage.jsx` (Espaços) — Gestão de tenants
- `src/components/admin/PlansPage.jsx` — Gestão de planos
- `src/components/admin/AuditPage.jsx` — Auditoria de eventos
- `src/lib/featureFlags.js` — Sistema de feature flags (12 flags, 3-tier resolution)
- Feature flags: window override > localStorage > defaults

### Banco de Dados (Supabase)
- Migrações em `supabase/migrations/` — aplicar com `npx supabase db push --linked`
- Extensões: pgcrypto está no schema `extensions` — wrappers públicos em `public.gen_random_bytes()`
- RLS habilitado em todas as tabelas de dados do usuário
- RPC `get_user_role_in_tenant` para controle de acesso

---

## Skills Hermes Agent Globais (perfil Penhall)

Skills disponíveis via `skill_view()` que se aplicam a este projeto:

| Skill | Uso |
|-------|-----|
| `audit-gate` | Auditoria pós-implementação com /goal do Claude Code |
| `post-phase-learning` | Extração de aprendizados ao final de cada fase |
| `safe-delegate` | Delegação segura com toolset restrito por tipo de tarefa |
| `claude-code-goal` | Referência completa do comando /goal |

---

## Post-Phase Learnings

<!-- Adicionar aprendizados no formato abaixo ao final de cada fase -->

<!--
## Fase: {NOME}
### Descobertas
- ...
### Decisões
- ...
### Comandos
- ...
### Estado
- ...
-->

## Fase: Rename Tenants → Clientes (Admin)
### Descobertas
- Labels do admin estavam espalhadas em 5+ arquivos: SidebarRail, TenantsPage, AdminDashboard, BillingPage, uxText
- Sidebar label vem de `SidebarRail.jsx`, não de App.jsx direto
- Página de listagem de tenants é o mesmo que "Clientes" do ponto de vista do admin SaaS

### Decisões
- Mantido nome interno `tenants` no código (variáveis, CSS classes) — só labels de UI foram alterados
- Refactor localizado: 7 arquivos, 11 insertions/11 deletions, sem quebra de testes

### Comandos
```bash
npm run lint && npm test && npm run build  # validar antes de commit
```
### Estado
- Commit: `58c7de8`
- Deploy: https://petto-flow.vercel.app ✅
- Pendente: Cadalora e Felipe criarem contas

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
