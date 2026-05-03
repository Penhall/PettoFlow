# Fase 5 - Contexto de Tenant Funcional

## Objetivo

Encerrar o estado hibrido da Fase 4 e fazer o NexusCRM operar no fluxo:

usuario autenticado -> membership ativa -> tenant ativo -> operacao de negocio escopada por tenant

## Diagnostico inicial

O diagnostico desta fase foi registrado em:

- `docs/PHASE_5_TENANT_CONTEXT_DIAGNOSTICO.md`

Pontos de partida:

- `tenant_id` ja existia nas tabelas de negocio
- o frontend ja sabia enviar `X-Tenant-Id`, mas nao tinha tenant ativo real
- o `workspace-core` ainda aceitava requests sem tenant
- `tenants`, `memberships` e `tenant_settings` ainda nao tinham fluxo funcional no app

## Arquivos criados

- `docs/PHASE_5_TENANT_CONTEXT_DIAGNOSTICO.md`
- `src/lib/activeTenant.js`
- `src/lib/tenantApi.js`
- `src/context/tenantContext.js`
- `src/context/TenantContext.jsx`
- `src/context/TenantContext.test.jsx`
- `src/hooks/useTenant.js`
- `src/components/tenant/WorkspaceOnboarding.jsx`
- `src/components/tenant/TenantSwitcher.jsx`
- `src/components/tenant/TenantGate.jsx`
- `src/components/tenant/TenantGate.test.jsx`
- `src/components/tenant/TenantSwitcher.test.jsx`
- `src/components/tenant/WorkspaceOnboarding.test.jsx`
- `src/lib/workspaceCore.test.js`
- `supabase/functions/tenant-core/index.ts`
- `supabase/migrations/20260502224000_tenant_core_rls.sql`

## Arquivos alterados

- `src/lib/apiFetch.js`
- `src/lib/apiFetch.test.js`
- `src/lib/workspaceCore.js`
- `src/main.jsx`
- `src/components/Header.jsx`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/tenant.ts`
- `supabase/functions/workspace-core/index.ts`

## Fluxo atual de tenant

1. `AuthProvider` valida a sessao Supabase.
2. `ProtectedRoute` bloqueia acesso sem autenticacao.
3. `TenantProvider` busca os tenants do usuario autenticado via `tenant-core`.
4. `TenantGate` decide entre:
   - onboarding de workspace, quando nao ha membership ativa
   - selecao de workspace, quando ha varios tenants e nenhum tenant salvo/ativo
   - renderizacao do app, quando existe `activeTenantId`
5. `workspaceCore` exige tenant ativo antes de qualquer operacao de negocio.

## Como o frontend define tenant ativo

- o tenant ativo fica centralizado em `TenantProvider`
- apenas o ID e persistido no `localStorage`
- chave permitida: `nexuscrm_active_tenant_id`
- se o tenant salvo nao pertence mais ao usuario, ele e limpo
- se houver exatamente um tenant ativo validado, ele e selecionado automaticamente
- se houver varios e nenhum selecionado de forma valida, o app pede escolha explicita

## Como o backend valida tenant

No backend:

- `supabase/functions/_shared/tenant.ts`
  - valida presenca de `X-Tenant-Id`
  - valida formato UUID
  - valida membership `active` por `user_id + tenant_id`
- `supabase/functions/workspace-core/index.ts`
  - exige tenant em todas as operacoes de negocio
  - retorna `400` para tenant ausente/invalido
  - retorna `401` para usuario nao autenticado
  - retorna `403` para acesso negado ao tenant
  - aplica filtro `tenant_id` em `SELECT`, `UPDATE` e `DELETE`
  - injeta `tenant_id` em `INSERT`
- `supabase/functions/tenant-core/index.ts`
  - lista tenants do usuario autenticado
  - cria tenant + membership owner via RPC `create_tenant_with_owner`
  - grava `tenant_settings` padrao
  - protege leitura/escrita de settings por membership

## O que deixou de funcionar sem tenant

- o dashboard nao monta sem `activeTenantId`
- `workspaceCore` falha localmente com erro explicito:
  - `Tenant ativo obrigatorio para operacao de negocio.`
- `workspace-core` nao aceita mais requests de negocio sem `X-Tenant-Id`
- o estado hibrido da Fase 4 foi encerrado para o fluxo principal de negocio

## RLS aplicado

A migration `20260502224000_tenant_core_rls.sql` ativou RLS real nas tabelas centrais:

- `tenants`
  - `SELECT` por membership `active`
  - `UPDATE` para `owner` e `admin`
- `memberships`
  - `SELECT` para usuarios que participam do tenant
- `tenant_settings`
  - `SELECT` por membership `active`
  - `UPDATE` para `owner` e `admin`

## O que ainda nao tem RLS completo

- tabelas de negocio com `tenant_id`
  - `tasks`
  - `clients`
  - `team`
  - `activities`
  - `transactions`
  - `receivables`
  - demais tabelas migradas na Fase 4
- escrita/gestao completa de `memberships`
- Telegram multi-tenant
- `bot_pending_confirmations`

Nesta fase isso foi intencional para nao quebrar o app sem validacao de rollout.

## Riscos pendentes

- as Edge Functions novas/alteradas nao foram validadas contra um banco Supabase local nesta sessao
- o join `memberships -> tenants` em `tenant-core` foi revisado no codigo, mas nao executado em ambiente live aqui
- o app ainda usa backend com `service_role` nas Edge Functions; isso continua aceitavel apenas para logica controlada por bearer + membership, nao como estado final de SaaS
- as tabelas de negocio ainda dependem de enforcement por Edge Function, nao de RLS direto
- Telegram admin continua bloqueado e deve permanecer assim ate fase dedicada

## Como testar manualmente

1. Entrar com um usuario autenticado sem memberships ativas.
2. Confirmar exibicao da tela `Criar seu workspace`.
3. Criar um workspace novo.
4. Confirmar redirecionamento funcional para o app com tenant ativo.
5. Confirmar exibicao do `TenantSwitcher` no header.
6. Se houver mais de um tenant, alternar o workspace ativo.
7. Confirmar que o dashboard continua funcional apos refresh da pagina.
8. Testar uma chamada ao `workspace-core` sem `X-Tenant-Id` e confirmar `400`.
9. Testar uma chamada com `X-Tenant-Id` de tenant sem membership e confirmar `403`.

## Resultado dos comandos

- `npm test`
  - passou: `14` arquivos de teste, `69` testes
  - observacao: o teste negativo de `useAuth` continua imprimindo stack esperada no console, mas a suite passa
- `npm run lint`
  - passou
- `npm run build`
  - passou
  - permaneceu o warning de chunks grandes do Vite no bundle principal
- `rg -n "WorkspaceGate|workspaceAccess|X-Workspace-Key|VITE_WORKSPACE_ACCESS_SECRET|VITE_BOT_CONFIG_SECRET|workspace_secret|bot_admin_secret" src supabase vite.config.js`
  - sem ocorrencias no codigo ativo

## Proxima fase recomendada

Aplicar isolamento mais forte no backend e no banco:

1. RLS nas tabelas de negocio por membership ativa
2. propagacao de role (`owner/admin/member/viewer`) nas operacoes sensiveis
3. gestao de membros do tenant
4. politicas de convite/suspensao
5. endurecimento adicional do backend para reduzir dependencia de `service_role`
