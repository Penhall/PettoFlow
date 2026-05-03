# Fase 6 - RLS nas Tabelas de Negocio e RBAC

## Objetivo

Mover o isolamento final de dados para o banco, aplicando RLS nas tabelas tenant-scoped de negocio e RBAC basico por `memberships`.

## Tabelas com RLS

RLS foi aplicado ou reforcado nas seguintes tabelas tenant-scoped:

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
- `bot_configs`
- `bot_commands`

Tabelas centrais que tambem foram alinhadas com as funcoes auxiliares desta fase:

- `tenants`
- `memberships`
- `tenant_settings`

## Politicas aplicadas

Base padrao nas tabelas de negocio:

- `SELECT`
  - permitido para membership `active`
- `INSERT`
  - permitido para `owner`, `admin`, `member`
  - proibido para `viewer`
- `UPDATE`
  - permitido para `owner`, `admin`, `member`
  - proibido para `viewer`
- `DELETE`
  - permitido apenas para `owner` e `admin`
  - `member` fica sem delete nesta fase por baseline conservadora
  - `viewer` proibido

Nas tabelas centrais:

- `tenants`
  - `SELECT` por membership ativa
  - `UPDATE` por `owner/admin`
- `memberships`
  - `SELECT` para participantes ativos do tenant
- `tenant_settings`
  - `SELECT` por membership ativa
  - `INSERT` por `owner/admin`
  - `UPDATE` por `owner/admin`

## RBAC definido

RBAC minimo consolidado nesta fase:

- `owner`
  - leitura total
  - escrita total
  - delete permitido
- `admin`
  - leitura total
  - escrita total
  - delete permitido
- `member`
  - leitura total
  - insert permitido
  - update permitido
  - delete negado nesta fase
- `viewer`
  - apenas leitura
  - insert, update e delete negados

## Funcoes SQL criadas

Na migration [20260502231500_business_tables_rls_rbac.sql](/E:/PROJETOS/PettoFlow/supabase/migrations/20260502231500_business_tables_rls_rbac.sql) foram criadas ou reforcadas:

- `public.is_member_of_tenant(user_id uuid, tenant_id uuid)`
- `public.is_active_member(user_id uuid, tenant_id uuid)`
- `public.get_user_role_in_tenant(user_id uuid, tenant_id uuid)`

Essas funcoes usam `security definer` para evitar duplicacao e recursion acidental nas policies.

Tambem foi reforcada:

- `public.create_tenant_with_owner(...)`
  - agora `security definer`
  - com `grant execute` para `authenticated`
  - permitindo criacao de tenant no fluxo comum sem depender de `service_role`

## Rollout aplicado

O rollout foi implementado na seguinte ordem logica:

1. diagnostico de impacto
2. funcoes SQL auxiliares
3. alinhamento das policies centrais com as funcoes auxiliares
4. aplicacao das policies de negocio em ordem:
   - `SELECT`
   - `INSERT`
   - `UPDATE`
   - `DELETE`
5. troca das Edge Functions principais para cliente user-scoped

Mesmo com as policies criadas no mesmo arquivo SQL, a ordem dentro da migration segue o rollout recomendado.

## Mudancas no backend

O endurecimento principal desta fase foi reduzir a dependencia do `service_role` no fluxo comum.

Arquivos alterados:

- [supabase/functions/_shared/supabase.ts](/E:/PROJETOS/PettoFlow/supabase/functions/_shared/supabase.ts)
  - adiciona `getServiceRoleClient()`
  - adiciona `getUserSupabaseClient(req)`
- [supabase/functions/workspace-core/index.ts](/E:/PROJETOS/PettoFlow/supabase/functions/workspace-core/index.ts)
  - agora opera com cliente user-scoped
  - continua validando tenant de forma defensiva
- [supabase/functions/tenant-core/index.ts](/E:/PROJETOS/PettoFlow/supabase/functions/tenant-core/index.ts)
  - agora opera com cliente user-scoped
- [supabase/functions/_shared/auth.ts](/E:/PROJETOS/PettoFlow/supabase/functions/_shared/auth.ts)
  - mantido com `service_role` apenas para validacao tecnica do token
- [supabase/functions/_shared/tenant.ts](/E:/PROJETOS/PettoFlow/supabase/functions/_shared/tenant.ts)
  - mantido com validacao defensiva de membership via cliente privilegiado

Resultado:

- `workspace-core` deixou de depender de bypass permanente do banco
- `tenant-core` tambem passou a respeitar RLS no fluxo comum
- `service_role` fica concentrado no que ainda faz sentido:
  - autenticacao tecnica do token
  - webhooks/fluxos internos como Telegram
  - checagens defensivas internas

## Impactos no sistema

Ganhos principais:

- acesso direto ao banco com sessao autenticada passa a respeitar tenant e role
- `viewer` nao consegue mais modificar dados nem por erro de UI nem por erro do backend
- Edge Functions principais passam a operar sob as mesmas restricoes do banco
- leitura cruzada entre tenants deixa de depender apenas de filtros manuais

Impactos controlados:

- `bot_configs` e `bot_commands` receberam RLS, mas a UI administrativa continua bloqueada
- o app continua funcional porque o tenant ativo e o header `X-Tenant-Id` ja tinham sido consolidados na Fase 5

## Riscos remanescentes

- as migrations de RLS nao foram aplicadas em banco local nesta sessao
- o `supabase db reset` falhou porque Docker Desktop nao esta disponivel no ambiente
- tabelas centrais e de negocio agora tem enforcement no banco, mas ainda vale revisar futuramente operacoes mais finas por recurso, nao apenas por role global
- `memberships` ainda nao tem fluxo completo de administracao de membros nesta fase
- `telegram-webhook` continua usando cliente privilegiado, o que e correto para webhook interno, mas deve seguir fora do fluxo comum

## Como validar seguranca

Validacoes recomendadas:

1. autenticar como usuario com membership `viewer`
2. tentar `INSERT`, `UPDATE` e `DELETE` diretamente nas tabelas tenant-scoped
3. confirmar bloqueio do banco
4. autenticar como `admin`
5. confirmar leitura e escrita dentro do proprio tenant
6. tentar consultar dados de outro tenant
7. confirmar bloqueio por RLS
8. testar chamadas do `workspace-core` e confirmar que:
   - tenant continua obrigatorio
   - o banco tambem barra acesso indevido mesmo se o backend errar

## Como validar operacionalmente

Comandos executados nesta sessao:

- `npm test`
  - passou: `14` arquivos, `69` testes
- `npm run lint`
  - passou
- `npm run build`
  - passou
- `npx supabase --version`
  - respondeu `2.98.0`
- `npx supabase db reset --local --no-seed --yes`
  - falhou por ausencia do Docker Desktop

## Conclusao

O NexusCRM sai desta fase com uma mudanca estrutural importante:

- antes: o isolamento dependia principalmente do backend
- agora: o banco passa a ser linha real de defesa para o fluxo principal

Ainda falta validacao local das migrations e refinamento futuro de autorizacao por acao, mas o projeto deixa de ser apenas "SaaS com controle na aplicacao" e passa a operar com "SaaS com isolamento garantido no banco" no desenho principal.
