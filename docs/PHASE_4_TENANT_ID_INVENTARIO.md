# Fase 4 - Inventario de Tabelas para `tenant_id`

Data: 2026-05-02

## Objetivo

Mapear as tabelas atualmente visiveis no repositorio para decidir, com justificativa, onde `tenant_id` deve ser introduzido nesta fase.

Fonte do inventario:

- queries reais em `supabase/functions/workspace-core/index.ts`
- queries reais em `supabase/functions/telegram-webhook/*`
- migrations versionadas em `supabase/migrations/`
- artefatos SQL/documentacao tecnica versionados no repositorio

## A. Tabelas de negocio - devem receber `tenant_id`

### `tasks`

- usada por dashboard, kanban, lista, calendario e Telegram
- representa dado operacional do workspace
- deve isolar tarefas por tenant

### `team`

- representa membros operacionais do workspace atual
- apesar do nome, funciona como cadastro de equipe por workspace
- deve ser escopada por tenant

### `clients`

- CRM principal
- deve ser integralmente isolada por tenant

### `kanban_columns`

- define estrutura do funil/quadro
- hoje e global, mas semanticamente pertence ao workspace
- deve receber `tenant_id`

### `activities`

- historico operacional e relacional
- usada por frontend e Telegram
- deve receber `tenant_id`

### `activity_templates`

- modelos operacionais do workspace
- nao devem ser compartilhados entre tenants por padrao
- devem receber `tenant_id`

### `accounts`

- contas financeiras pertencem ao workspace
- usadas por financas e Telegram
- devem receber `tenant_id`

### `payees`

- cadastro financeiro do workspace
- deve receber `tenant_id`

### `fin_rules`

- regras automaticas financeiras do workspace
- devem receber `tenant_id`

### `category_groups`

- agrupadores de categorias financeiras
- pertencem ao tenant
- devem receber `tenant_id`

### `fin_categories`

- categorias financeiras
- pertencem ao tenant
- devem receber `tenant_id`

### `transactions`

- lancamentos financeiros
- dado sensivel e central
- devem receber `tenant_id`

### `receivables`

- contas a receber oriundas de tarefas/atividades
- devem receber `tenant_id`

### `interaction_logs`

- historico comercial/CRM por cliente
- deve receber `tenant_id`

## B. Tabelas globais - NAO devem receber `tenant_id`

### `tenants`

- e a propria entidade raiz de tenancy
- nao pode depender de `tenant_id`

### `memberships`

- representa acesso de usuarios a tenants
- tambem nao deve receber `tenant_id`; ja referencia `tenant_id` como dado de controle

### `tenant_settings`

- e configuracao por tenant
- ja e naturalmente escopada por `tenant_id`

### `auth.users`

- tabela externa do Supabase Auth
- global por definicao de identidade
- usada apenas como referencia

## C. Tabelas de configuracao por tenant

### `bot_configs`

- configuracao de integracao Telegram
- semanticamente deve pertencer a um tenant
- deve receber `tenant_id`

Recomendacao:
- manter no maximo uma configuracao de bot por tenant

### `bot_commands`

- comandos configurados para o bot
- semanticamente pertencem ao tenant e ao bot configurado daquele tenant
- deve receber `tenant_id`

Recomendacao:
- manter relacao com `bot_config_id`
- adicionar tambem `tenant_id` para filtros, auditoria e joins simples

## D. Tabelas incertas

### `bot_pending_confirmations`

Motivo da incerteza:
- hoje e uma tabela operacional efemera do fluxo Telegram
- o bot administrativo ainda esta bloqueado
- o webhook atual continua assumindo configuracao global de bot

Risco de adicionar `tenant_id` agora:
- pode cristalizar uma modelagem incompleta do Telegram antes da fase dedicada
- pode exigir mudancas adicionais no webhook global antes da estrategia multi-tenant estar definida

Risco de nao adicionar `tenant_id` agora:
- a tabela continua incapaz de isolar confirmacoes por tenant
- `chat_id` sozinho pode ficar ambiguo em uma arquitetura futura com multiplas integracoes

Recomendacao:
- nao migrar nesta fase
- manter como tabela incerta e tratar na fase especifica de Telegram multi-tenant

## Tabelas nao encontradas no codigo versionado atual

As seguintes tabelas apareceram em requisitos genericos, mas nao foram encontradas como nome real no repositorio atual:

- `team_members` - o nome real em uso e `team`
- `notes` - notas estao embutidas em `activities`
- `attachments` - nao ha tabela versionada correspondente
- `plans` - ainda nao existe no banco atual
- feature flags globais - nao ha tabela versionada correspondente

## Dependencias relevantes mapeadas

### Backend principal

`supabase/functions/workspace-core/index.ts` faz CRUD sem escopo de tenant em:

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

### Backend Telegram

`supabase/functions/telegram-webhook/index.ts` e helpers usam:

- `bot_configs`
- `bot_commands`
- `bot_pending_confirmations`
- `tasks`
- `activities`
- `accounts`
- `transactions`
- `kanban_columns`

### Frontend

O frontend consome principalmente `workspace-core` por `src/lib/workspaceCore.js`.

Conclusao pratica:
- o maior risco de contaminacao continua no `workspace-core`, porque ele concentra grande volume de tabelas sem tenant explicito

## Recomendacao final do inventario

Nesta fase devem receber `tenant_id`:

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

Nesta fase nao devem receber `tenant_id`:

- `tenants`
- `memberships`
- `tenant_settings`
- `auth.users`

Devem permanecer incertas e fora da migration atual:

- `bot_pending_confirmations`
