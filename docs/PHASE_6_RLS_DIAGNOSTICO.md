# Fase 6 - Diagnostico de Impacto do RLS

## Objetivo

Mapear as tabelas de negocio com `tenant_id`, as operacoes reais do sistema e o impacto esperado ao mover o isolamento final para o banco com RLS + RBAC.

## Tabelas com `tenant_id`

Tabelas de negocio ativas no app:

- `tasks`
- `kanban_columns`
- `team`
- `clients`
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

Tabelas tenant-scoped fora do fluxo principal atual:

- `bot_configs`
- `bot_commands`

Tabelas centrais que ja possuem RLS:

- `tenants`
- `memberships`
- `tenant_settings`

## Queries e operacoes existentes

### `workspace-core`

Leituras:

- `tasks`
  - bootstrap
  - arquivadas com filtros
- `kanban_columns`
  - bootstrap
- `team`
  - bootstrap
- `clients`
  - bootstrap
- `activities`
  - listagem
- `activity_templates`
  - listagem
- `accounts`
  - listagem geral
  - listagem de contas ativas
- `payees`
  - listagem
- `fin_rules`
  - listagem
- `category_groups`
  - listagem
- `fin_categories`
  - listagem
- `transactions`
  - listagem com filtros
- `receivables`
  - listagem com joins
- `interaction_logs`
  - listagem por cliente

Escritas:

- `tasks`
  - insert
  - update
  - delete
  - archive
  - restore
- `kanban_columns`
  - insert
  - delete
- `team`
  - insert
  - update
  - delete
- `clients`
  - insert
  - update
  - delete
- `activities`
  - insert
  - update
  - delete
- `activity_templates`
  - insert
  - update
  - delete
- `accounts`
  - insert
  - update
- `payees`
  - insert
  - update
- `fin_rules`
  - insert
  - update
  - delete
- `category_groups`
  - insert
- `fin_categories`
  - insert
  - update
- `transactions`
  - insert
  - update
  - delete
- `receivables`
  - insert
  - update
- `interaction_logs`
  - insert

### `tenant-core`

Leituras:

- `memberships`
  - listar tenants ativos do usuario
- `tenants`
  - leitura do tenant criado
- `tenant_settings`
  - leitura por tenant

Escritas:

- `tenant_settings`
  - upsert do perfil inicial do workspace
  - update posterior
- `tenants` + `memberships`
  - criacao indireta via RPC `create_tenant_with_owner(...)`

## Roles e acessos esperados

Base alvo desta fase:

- `owner`
  - leitura total dentro do tenant
  - escrita total dentro do tenant
  - delete permitido
- `admin`
  - leitura total dentro do tenant
  - escrita total dentro do tenant
  - delete permitido
- `member`
  - leitura total dentro do tenant
  - insert permitido
  - update permitido
  - delete negado nesta fase por baseline conservadora
- `viewer`
  - apenas leitura
  - insert, update e delete proibidos

## Impacto esperado ao ativar RLS

Impactos desejados:

- acesso direto ao banco com `anon key` passa a respeitar tenant e membership
- Edge Functions deixam de depender exclusivamente de filtros manuais
- `viewer` perde capacidade de modificar dados mesmo que a UI ou o backend falhem
- leitura cruzada entre tenants passa a ser bloqueada no banco

Impactos de quebra provavel:

- `workspace-core` usando `service_role` continuaria contornando RLS; isso precisa mudar
- `tenant-core` tambem precisa operar com cliente user-scoped onde a leitura deve obedecer RLS
- `create_tenant_with_owner(...)` precisa continuar funcional sem `service_role` permanente
- joins e selects compostos, especialmente em `receivables`, precisam ser observados com cuidado

## Riscos de quebra

1. Ativar RLS nas tabelas de negocio e manter `service_role` nas Edge Functions criaria falsa sensacao de seguranca.
2. Ativar policies sem funcoes auxiliares aumentaria duplicacao e risco de inconsistencias de RBAC.
3. Ativar DELETE de forma ampla para `member` elevaria risco operacional sem necessidade para esta fase.
4. `bot_configs` e `bot_commands` precisam receber RLS por coerencia de tenant, mas nao devem ser reativados no frontend.
5. Sem Supabase local operacional nesta sessao, a validacao do SQL fica limitada a revisao estatica e ao hardening do codigo.

## Strategia de rollout

1. Criar funcoes SQL auxiliares para membership e role.
2. Ajustar `create_tenant_with_owner(...)` para seguir funcional sem depender de `service_role` no fluxo comum.
3. Aplicar RLS nas tabelas de negocio com policies organizadas em ordem:
   - `SELECT`
   - `INSERT`
   - `UPDATE`
   - `DELETE`
4. Trocar `workspace-core` e `tenant-core` para cliente user-scoped onde o RLS deve atuar.
5. Manter validacao defensiva de tenant nas Edge Functions.
6. Verificar testes do app, lint e build.

## Conclusao

O principal trabalho da Fase 6 nao e apenas criar policies; e alinhar as Edge Functions para que elas parem de executar o fluxo principal de negocio como `service_role`.

Sem isso, o banco continuaria com RLS no papel, mas nao como ultima linha real de defesa.
