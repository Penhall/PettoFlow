# Fase 7 - Membership

## Objetivo

Adicionar colaboracao real por tenant com:

- convites por email
- aceite autenticado por token
- alteracao de roles
- suspensao
- remocao de membros

## Modelagem de convite

Foi criada a migration [20260502235900_membership_invites_management.sql](/E:/PROJETOS/PettoFlow/supabase/migrations/20260502235900_membership_invites_management.sql) com:

- tabela `public.invitations`
- token unico
- expiracao
- rastreio de `invited_by`, `accepted_by` e `accepted_at`
- indices por `tenant_id`, `email` e convite pendente por tenant/email

Nesta fase, convites aceitam apenas roles:

- `admin`
- `member`
- `viewer`

Promocao direta para `owner` ficou fora do fluxo para reduzir risco.

## Fluxo de aceitacao

O frontend agora reconhece `?invite=<token>` no carregamento do tenant context em [TenantContext.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.jsx).

Fluxo:

1. usuario autentica via Supabase Auth
2. `TenantProvider` tenta aceitar o convite
3. backend valida token, expiracao e email do usuario autenticado
4. `membership` e ativada/criada
5. o token e removido da URL
6. os tenants do usuario sao recarregados

## RBAC aplicado

Roles existentes:

- `owner`
- `admin`
- `member`
- `viewer`

Regras implementadas:

- apenas `owner/admin` gerenciam membros
- `viewer/member` nao acessam a UI administrativa
- ninguem altera a propria role
- ninguem remove a propria membership
- `admin` nao gerencia outro `admin`
- `owner` continua protegido
- o ultimo `owner` nao pode ser removido ou suspenso

## Politicas RLS

`invitations` recebeu RLS para leitura administrativa por tenant.

As mutacoes sensiveis de `memberships` e `invitations` nao ficaram abertas por CRUD generico. Em vez disso, esta fase usa funcoes SQL `security definer` para preservar invariantes que RLS simples nao cobre bem:

- `create_invitation`
- `accept_invitation`
- `list_tenant_members`
- `list_tenant_invitations`
- `update_membership_role`
- `set_membership_status`
- `remove_membership`

## Validacoes de seguranca

Foram implementadas validacoes para:

- token invalido
- token expirado
- email diferente do usuario autenticado
- convite para email ja membro ativo
- auto-elevacao
- auto-remocao
- remocao do ultimo owner
- mutacao de membership fora do tenant do ator

## Arquivos principais

Criados:

- [invite-member/index.ts](/E:/PROJETOS/PettoFlow/supabase/functions/invite-member/index.ts)
- [memberApi.js](/E:/PROJETOS/PettoFlow/src/lib/memberApi.js)
- [useMembers.js](/E:/PROJETOS/PettoFlow/src/hooks/useMembers.js)
- [MembersPage.jsx](/E:/PROJETOS/PettoFlow/src/components/tenant/MembersPage.jsx)
- [memberPermissions.js](/E:/PROJETOS/PettoFlow/src/lib/memberPermissions.js)
- [SettingsView.test.jsx](/E:/PROJETOS/PettoFlow/src/components/Settings/SettingsView.test.jsx)
- [MembersPage.test.jsx](/E:/PROJETOS/PettoFlow/src/components/tenant/MembersPage.test.jsx)
- [memberPermissions.test.js](/E:/PROJETOS/PettoFlow/src/lib/memberPermissions.test.js)

Alterados:

- [SettingsView.jsx](/E:/PROJETOS/PettoFlow/src/components/Settings/SettingsView.jsx)
- [TenantContext.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.jsx)
- [TenantContext.test.jsx](/E:/PROJETOS/PettoFlow/src/context/TenantContext.test.jsx)

## Riscos remanescentes

- a migration foi criada e revisada, mas nao foi aplicada em um banco local nesta sessao
- ainda nao existe envio real de email; o fluxo entrega o token/link, mas o disparo pode ser integrado depois
- promocao para `owner` segue fora do escopo desta fase
- gestao completa de invites expirados/cancelados ainda pode evoluir

## Resultado dos comandos

- `npm test`: 17 arquivos, 79 testes passaram
- `npm run lint`: passou
- `npm run build`: passou

Observacao:

- o build continua com aviso de chunk acima de `500 kB`
- o Vitest emite warnings do Vite sobre `esbuild/oxc`, mas a suite passou

## Como validar seguranca

1. autentique um usuario owner/admin
2. abra `Configuracoes > Membros`
3. envie convite para outro email
4. autentique o segundo usuario e abra o link `?invite=<token>`
5. confirme que o tenant aparece no TenantProvider
6. valide troca de role, suspensao e remocao
7. valide que `member/viewer` nao administram membros
8. valide que auto-elevacao e remocao do ultimo owner retornam erro

## Proxima fase recomendada

Fechar o ciclo colaborativo com:

- UI de memberships mais refinada
- convites por email real
- pagina dedicada de membros/workspace
- auditoria de acoes administrativas
- refinamento de RBAC por recurso
