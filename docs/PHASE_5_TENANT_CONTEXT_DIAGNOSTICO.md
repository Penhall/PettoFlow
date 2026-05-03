# Fase 5 - Diagnostico do Contexto de Tenant

## Objetivo

Registrar o estado hibrido atual do NexusCRM antes da ativacao obrigatoria de tenant no frontend e no backend.

## Onde `tenant_id` ja existe

As tabelas preparadas na Fase 4 ja possuem coluna `tenant_id` estrutural:

- `tasks`
- `team`
- `clients`
- `kanban_columns`
- `activities`
- `activity_templates`
- `accounts`
- `payees`
- `fin_rules`
- `category_groups`
- `fin_categories`
- `transactions`
- `receivables`
- `interaction_logs`
- `bot_configs`
- `bot_commands`

As tabelas centrais de SaaS tambem ja existem:

- `tenants`
- `memberships`
- `tenant_settings`

## Onde `tenant_id` ja e enviado

- `src/lib/apiFetch.js`
  - ja aceita `tenantId`
  - ja envia `X-Tenant-Id` quando o valor e fornecido
- `src/lib/workspaceCore.js`
  - `workspaceCoreRequest(...)` aceita `tenantId`
  - o tenant ainda nao e exigido pelas funcoes de alto nivel

## Onde `tenant_id` ja e filtrado

- `supabase/functions/workspace-core/index.ts`
  - aplica `eq('tenant_id', tenantId)` quando o header existe
  - injeta `tenant_id` em inserts e updates quando o header existe
- `supabase/functions/_shared/tenant.ts`
  - ja possui `requireTenantId(req)`
  - ja possui `assertUserCanAccessTenant(userId, tenantId)`
  - ja possui `requireTenantAccess(req, userId)`

## Onde o backend ainda aceita request sem tenant

O principal ponto inseguro atual e `supabase/functions/workspace-core/index.ts`.

Hoje ele:

- autentica o usuario com bearer token
- le `X-Tenant-Id` de forma opcional
- aceita chamadas de negocio sem tenant
- so filtra por tenant quando o header e enviado

Isso deixa o sistema em estado hibrido:

- tenant-aware quando o cliente coopera
- global quando o cliente nao envia tenant

## Tabelas e modulos ja preparados

Preparados estruturalmente:

- `tenants`
- `memberships`
- `tenant_settings`
- tabelas de negocio listadas acima

Preparados parcialmente no codigo:

- `src/lib/apiFetch.js`
- `src/lib/workspaceCore.js`
- `supabase/functions/_shared/tenant.ts`
- `supabase/functions/workspace-core/index.ts`

## Modulos que ainda nao podem ser considerados SaaS-ready

- `src/App.jsx`
  - dispara bootstrap de negocio no mount sem tenant ativo
- hooks e views que consomem `workspaceCore`
  - ainda assumem chamadas sem tenant centralizado
- `workspace-core`
  - ainda tolera operacao global sem tenant
- `tenants`, `memberships` e `tenant_settings`
  - ainda sem fluxo funcional no frontend
  - ainda sem RLS operacional por membership
- Telegram admin
  - continua corretamente bloqueado
  - nao deve ser reativado nesta fase

## Impacto esperado ao exigir tenant

Impactos desejados:

- usuario autenticado sem tenant deixara de acessar o dashboard diretamente
- o app precisara de onboarding de workspace
- toda chamada de negocio passara a depender de `activeTenantId`
- requests sem tenant deixarao de funcionar no `workspace-core`

Impactos de risco:

- `App.jsx` precisa ser protegido para nao disparar bootstrap cedo demais
- hooks existentes podem quebrar se o tenant nao for propagado de forma centralizada
- `workspace-core` precisa diferenciar corretamente:
  - `400` para tenant ausente ou invalido
  - `401` para usuario nao autenticado
  - `403` para membership ausente/inativa

## Plano incremental de ativacao

1. Criar API segura de tenant para listar tenants do usuario e criar workspace com owner.
2. Criar `TenantProvider`, `useTenant` e `TenantGate`.
3. Adicionar onboarding para usuario autenticado sem membership ativa.
4. Introduzir seletor de tenant ativo na interface.
5. Fazer `workspaceCore` e `apiFetch` recusarem operacoes de negocio sem tenant ativo.
6. Atualizar `workspace-core` para exigir `X-Tenant-Id` valido e membership `active`.
7. Ativar RLS real em `tenants`, `memberships` e `tenant_settings`.
8. Registrar o fim do estado hibrido na documentacao da fase.

## Estado de seguranca antes da Fase 5

- autenticacao real: sim
- tenant ativo obrigatorio: nao
- validacao de membership no backend: parcial
- operacao de negocio sem tenant: ainda permitida
- RLS por membership nas tabelas centrais: ainda nao
- Telegram admin: bloqueado

## Conclusao

O NexusCRM ja tem a fundacao estrutural para multi-tenancy, mas ainda nao opera como SaaS real.

O objetivo desta fase deve ser encerrar o modo hibrido:

- usuario autenticado -> membership ativa -> tenant ativo -> operacao de negocio escopada por tenant
