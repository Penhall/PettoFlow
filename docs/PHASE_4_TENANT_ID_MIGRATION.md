# Fase 4 - Migracao de `tenant_id`

Data: 2026-05-02

## Objetivo

Preparar o NexusCRM para isolamento real por tenant adicionando `tenant_id` nas tabelas de negocio e nas configuracoes por tenant, com estrategia segura para dados legados e sem ativar ainda RLS completo por membership.

## Inventario das tabelas

Inventario completo salvo em:

- `docs/PHASE_4_TENANT_ID_INVENTARIO.md`

Resumo da decisao:

- negocio com `tenant_id`: `tasks`, `team`, `clients`, `kanban_columns`, `activities`, `activity_templates`, `accounts`, `payees`, `fin_rules`, `category_groups`, `fin_categories`, `transactions`, `receivables`, `interaction_logs`
- configuracao por tenant com `tenant_id`: `bot_configs`, `bot_commands`
- fora desta migration: `tenants`, `memberships`, `tenant_settings`, `auth.users`, `bot_pending_confirmations`

## Tabelas que receberam `tenant_id`

A migration criada foi:

- `supabase/migrations/20260502171000_tenant_id_business_tables.sql`

Tabelas alteradas:

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

## Tabelas que nao receberam `tenant_id`

- `tenants`
- `memberships`
- `tenant_settings`
- `auth.users`
- `bot_pending_confirmations`

Justificativa principal para `bot_pending_confirmations`:
- tabela ainda depende da futura arquitetura multi-tenant do Telegram
- adicionar `tenant_id` agora poderia cristalizar uma modelagem incompleta do fluxo do bot

## Estrategia de tenant default

Nao foi assumido automaticamente nenhum `owner_user_id`.

Como o repositorio nao oferece evidencia confiavel sobre qual usuario de `auth.users` deve ser owner do tenant legado, a fase foi dividida em:

### Etapa estrutural

A migration:

- adiciona `tenant_id`
- cria foreign keys
- cria indices
- cria helper SQL para criar tenant com owner
- cria helper SQL para backfill legado

### Etapa operacional

O tenant default so e criado manualmente, com owner explicito e auditavel.

Nome padrao definido:

- `name = 'Workspace Migrado'`
- `slug = 'workspace-migrado'`

Helper criado:

- `public.create_tenant_with_owner(owner_user_id, name, slug)`

## Backfill aplicado

A migration implementa backfill condicional:

- se ja existir tenant com slug `workspace-migrado`, ela roda `public.backfill_legacy_tenant(...)` automaticamente
- se nao existir, ela emite `NOTICE` e deixa a finalizacao para etapa operacional manual

Regra de seguranca:

- `tenant_id` so vira `NOT NULL` quando o backfill e executado com sucesso

Helper criado:

- `public.backfill_legacy_tenant(tenant_id uuid)`

Esse helper:

- popula `tenant_id` nas tabelas migradas
- tenta derivar `bot_commands.tenant_id` a partir de `bot_configs.tenant_id`
- finaliza a fase estrutural chamando `public.finalize_legacy_tenant_columns()`

## Constraints alteradas

### `kanban_columns.name`

Risco:
- a documentacao legada indicava `name TEXT UNIQUE`
- isso impediria dois tenants de terem colunas com o mesmo nome

Ajuste aplicado:

- remocao defensiva de unicidade global apenas em `name`
- nova unicidade por tenant:
  - `unique (tenant_id, name)`

### `bot_configs`

Regra nova:
- um tenant pode ter no maximo uma configuracao principal de bot nesta arquitetura inicial

Ajuste aplicado:

- indice unico por `tenant_id`

### Constraints nao alteradas

Nao foram alteradas outras unicidades sem evidencia concreta de necessidade.

Exemplos deliberadamente adiados:

- comandos por `trigger`
- `payees.name`
- `clients.name`

Motivo:
- falta de definicao formal no schema versionado atual
- evitar quebrar dados legados sem validacao

## Indices criados

Foram criados indices por `tenant_id` e compostos apenas onde o codigo atual mostra padrao claro de acesso.

Exemplos principais:

- `tasks(tenant_id)`
- `tasks(tenant_id, created_at desc)`
- `tasks(tenant_id, status)`
- `tasks(tenant_id, client_id)`
- `clients(tenant_id, name)`
- `kanban_columns(tenant_id, order_index)`
- `kanban_columns(tenant_id, name)` unique
- `activities(tenant_id, created_at desc)`
- `accounts(tenant_id, is_active)`
- `fin_rules(tenant_id, priority)`
- `fin_categories(tenant_id, group_id)`
- `transactions(tenant_id, date desc)`
- `transactions(tenant_id, account_id)`
- `transactions(tenant_id, category_id)`
- `receivables(tenant_id, created_at desc)`
- `receivables(tenant_id, status)`
- `receivables(tenant_id, task_id)`
- `receivables(tenant_id, activity_id)`
- `interaction_logs(tenant_id, client_id)`
- `interaction_logs(tenant_id, created_at desc)`
- `bot_configs(tenant_id)` unique
- `bot_commands(tenant_id, bot_config_id)`

## Helpers criados

### SQL helpers

Na migration:

- `public.add_tenant_column_and_fk(...)`
- `public.create_table_index_if_exists(...)`
- `public.create_tenant_with_owner(...)`
- `public.backfill_legacy_tenant(...)`
- `public.finalize_legacy_tenant_columns()`

### Backend helper

Arquivo criado:

- `supabase/functions/_shared/tenant.ts`

Funcoes:

- `getTenantIdFromRequest(req)`
- `requireTenantId(req)`
- `assertUserCanAccessTenant(userId, tenantId)`
- `requireTenantAccess(req, userId)`

### Frontend prep

Arquivos preparados:

- `src/lib/apiFetch.js`
- `src/lib/workspaceCore.js`

Mudancas:

- `authenticatedFetch` agora aceita `tenantId`
- quando presente, envia `X-Tenant-Id`
- `workspaceCoreRequest` foi exposto para futuras chamadas tenant-aware

## Endpoints preparados

### `workspace-core`

Arquivo:

- `supabase/functions/workspace-core/index.ts`

Preparacao aplicada:

- detecta `X-Tenant-Id` quando presente
- injeta `tenant_id` em inserts/updates das tabelas migradas
- aplica filtro por `tenant_id` em leituras e mutacoes quando o header e enviado

Importante:

- ainda nao exige `tenant_id` obrigatoriamente
- ainda nao bloqueia chamadas sem tenant header
- isso e intencional, porque o app ainda nao tem selecao ativa de tenant nem backfill finalizado

### Endpoints ainda inseguros ou incompletos

- `workspace-core` continua funcional sem tenant header
- `telegram-webhook` ainda opera fora do modelo multi-tenant
- `bot_pending_confirmations` continua sem `tenant_id`
- `bot-config` e `bot-commands` seguem bloqueados por seguranca

## Garantia owner -> membership

A regra foi tratada como obrigatoria.

Implementacao:

- `public.create_tenant_with_owner(...)` cria ou reaproveita tenant pelo slug
- sempre garante `membership`:
  - `tenant_id = tenant criado`
  - `user_id = owner_user_id`
  - `role = 'owner'`
  - `status = 'active'`

Isso evita criar tenant sem membership correspondente do owner.

## Riscos pendentes

- a migration estrutural foi criada, mas nao foi aplicada contra um banco local nesta sessao
- sem tenant ativo no frontend, o header `X-Tenant-Id` ainda nao circula pelo app real
- `workspace-core` continua aceitando operacoes sem tenant header para nao quebrar a base antes do backfill e da selecao de tenant
- `telegram-webhook` continua global e fora do modelo final
- `bot_pending_confirmations` segue fora do escopo desta fase

## Como validar a migration

### Validacao estrutural manual

1. Escolher explicitamente um `owner_user_id` confiavel em `auth.users`
2. Criar o tenant legado:

```sql
select public.create_tenant_with_owner(
  '<OWNER_USER_ID>'::uuid,
  'Workspace Migrado',
  'workspace-migrado'
);
```

3. Obter o `tenant_id` criado:

```sql
select id, slug, owner_user_id
from public.tenants
where slug = 'workspace-migrado';
```

4. Rodar o backfill:

```sql
select public.backfill_legacy_tenant('<TENANT_ID>'::uuid);
```

5. Conferir se nao restaram `tenant_id` nulos nas tabelas migradas
6. Validar se `kanban_columns` permite nomes repetidos entre tenants diferentes, mas nao no mesmo tenant

### Validacao do app

1. Rodar frontend normalmente
2. Confirmar que `apiFetch` continua autenticando por bearer token
3. Confirmar que o header `X-Tenant-Id` pode ser enviado quando um `tenantId` for fornecido
4. Confirmar que `workspace-core` continua operacional sem tenant ativo, mas ja filtra por tenant quando o header existir

## Resultado dos comandos

### `npm test`

- passou
- 9 arquivos de teste
- 57 testes aprovados

Observacao:
- permanece o output esperado do teste negativo de `useAuth`, sem falha da suite

### `npm run lint`

- passou

### `npm run build`

- passou

### Supabase CLI local

Tentativas executadas:

- `npx supabase --version`
- `npx supabase db reset --help`

Resultado:

- o CLI nao respondeu dentro do timeout desta sessao
- nao foi possivel confirmar um ambiente local utilizavel para `supabase db reset`

Conclusao:

- a migration foi criada e revisada no repositorio
- a aplicacao local contra banco Supabase deve ser validada manualmente em ambiente com CLI funcional ou projeto local ja inicializado

## Proxima fase recomendada

Fase 5:

- contexto de tenant no frontend
- selecao de tenant ativo
- onboarding inicial de workspace
- exigencia de tenant no backend
- RLS real por membership ativa
