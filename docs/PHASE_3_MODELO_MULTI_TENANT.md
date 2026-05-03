# Fase 3 - Modelo Multi-Tenant Base

Data: 2026-05-02

## Objetivo

Introduzir a modelagem estrutural inicial de SaaS para o NexusCRM com as tabelas:

- `tenants`
- `memberships`
- `tenant_settings`

Esta fase cria o nucleo de tenancy, mas nao adiciona `tenant_id` ainda nas tabelas de negocio legadas.

## Decisao aplicada

Foi adotada uma estrategia em duas camadas:

1. criar primeiro as entidades centrais de tenancy;
2. adotar `tenant_id` nas entidades de negocio e RLS por membership em fase separada.

Motivo:
- reduzir risco de migracao;
- evitar alterar toda a base antes de existir o modelo canonical de tenant;
- permitir que as proximas fases referenciem tabelas e relacionamentos estaveis.

## Implementacoes realizadas

### 1. Nova migration estrutural

Arquivo criado:

- `supabase/migrations/20260502162000_saas_core_tenants.sql`

### 2. Tabela `tenants`

Campos principais:

- `id uuid primary key`
- `name text not null`
- `slug text not null`
- `owner_user_id uuid not null references auth.users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

Protecoes adicionais:

- `name` nao pode ser vazio
- `slug` nao pode ser vazio
- `slug` deve seguir padrao URL-safe em lowercase
- indice unico por `lower(slug)`
- indice por `owner_user_id`

### 3. Tabela `memberships`

Campos principais:

- `id uuid primary key`
- `tenant_id uuid not null references tenants(id)`
- `user_id uuid not null references auth.users(id)`
- `role text not null`
- `status text not null`
- `created_at timestamptz`
- `updated_at timestamptz`

Regras aplicadas:

- `role in ('owner', 'admin', 'member', 'viewer')`
- `status in ('active', 'invited', 'suspended')`
- unicidade por `(tenant_id, user_id)`
- indices por `tenant_id`, `user_id` e `status`

### 4. Tabela `tenant_settings`

Campos principais:

- `id uuid primary key`
- `tenant_id uuid not null references tenants(id)`
- `key text not null`
- `value jsonb not null default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Regras aplicadas:

- `key` nao pode ser vazio
- unicidade por `(tenant_id, key)`
- indice por `tenant_id`

### 5. Trigger padrao de `updated_at`

Foi criada a funcao:

- `public.set_row_updated_at()`

Ela foi aplicada como trigger `before update` nas tres tabelas novas para manter `updated_at` consistente sem duplicar logica.

### 6. RLS seguro por padrao

As tres tabelas novas foram criadas com:

- `row level security` habilitado
- politica temporaria `service role full access`

Decisao:
- enquanto o modelo de membership ainda nao governa queries reais, manter acesso fechado por padrao e liberar apenas backend privilegiado controlado

## O que esta pronto ao final da fase

- base canonical para tenants
- base canonical para memberships
- base canonical para configuracoes por tenant
- chaves estrangeiras para `auth.users`
- integridade basica de slug, role e status
- timestamps consistentes
- RLS fechado por padrao

## O que deliberadamente NAO foi feito nesta fase

- adicionar `tenant_id` em `tasks`, `clients`, `activities`, `transactions`, `receivables` e demais tabelas de negocio
- criar tenant default para dados legados
- migrar registros existentes
- criar politicas RLS por `auth.uid()`
- criar onboarding de workspace
- criar selecao de tenant no frontend
- liberar operacoes de negocio baseadas em memberships

## Impacto arquitetural

Depois desta fase, o NexusCRM deixa de tratar multi-tenancy como ideia abstrata e passa a ter:

- uma entidade oficial de tenant
- uma entidade oficial de membership
- uma entidade oficial de configuracao por tenant

Isso reduz ambiguidade para as proximas fases e evita que `tenant_id` seja espalhado nas tabelas sem um modelo central consolidado.

## Riscos e limites restantes

- o sistema ainda nao isola dados de negocio por tenant
- `workspace-core` continua sem escopo de tenant
- `service_role` ainda segue sendo usado como base operacional nos endpoints legados
- ainda nao existe fluxo de criacao automatica de tenant + membership owner
- ainda nao existe garantia automatica de que `owner_user_id` tenha membership `owner` correspondente

## Estrategia recomendada para a proxima fase

Adicionar `tenant_id` nas entidades de negocio com estrategia de migracao controlada:

1. criar tenant default de migracao para os dados atuais
2. adicionar `tenant_id` com backfill seguro
3. criar indices por `tenant_id`
4. ajustar constraints e foreign keys
5. preparar consultas e endpoints para sempre exigir escopo de tenant

## Verificacao executada

Como esta fase altera apenas migrations e documentacao estrutural:

- `npm test` foi executado para checar regressao no frontend
- `npm run lint` foi executado
- `npm run build` foi executado

Observacao:
- nao houve validacao contra banco Supabase local nesta fase, porque o repositório nao expoe neste fluxo um ambiente de banco local pronto para aplicar a migration automaticamente

## Resultado dos comandos

### `npm test`

- passou
- 9 arquivos de teste
- 56 testes aprovados

### `npm run lint`

- passou

### `npm run build`

- passou

## Proxima fase recomendada

Fase 4:

- adicionar `tenant_id` nas tabelas de negocio
- criar tenant default de migracao
- preparar backfill dos dados legados
- iniciar escopo de tenant no backend
