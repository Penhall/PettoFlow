# Fase 7 - Diagnostico de Membership

## Estrutura atual de `memberships`

A tabela `memberships` ja existe com:

- `id`
- `tenant_id`
- `user_id`
- `role`
- `status`
- `created_at`
- `updated_at`

Valores atuais de `role`:

- `owner`
- `admin`
- `member`
- `viewer`

Valores atuais de `status`:

- `active`
- `invited`
- `suspended`

## Estado atual de autorizacao

Ja existe:

- autenticacao via Supabase Auth
- tenant ativo no frontend
- validacao defensiva de tenant + membership nas Edge Functions
- RLS nas tabelas centrais e de negocio
- RBAC basico nas tabelas de negocio

Ainda nao existe:

- fluxo formal de convite
- tabela de convites
- aceite de convite por token
- alteracao de role via interface
- suspensao/remocao administrativa de membros
- protecao de regras sensiveis como:
  - impedir auto-elevacao
  - impedir remocao do ultimo owner
  - impedir promocao direta para owner por admin

## Lacunas atuais

1. `memberships` representa estado, mas nao representa o processo de entrada de um novo colaborador.
2. Nao existe rastreabilidade de convite por email/token/expiracao.
3. O frontend conhece o role do tenant ativo, mas ainda nao tem UI de administracao.
4. O backend valida membership, mas nao oferece operacoes seguras de administracao de membros.
5. A politica de `suspended` ainda nao tem fluxo operacional completo.

## Riscos de seguranca

- permitir mutacao direta em `memberships` sem regras adicionais quebraria a seguranca da Fase 6
- admin promovendo a si mesmo ou outro usuario para `owner` sem regra explicita
- remocao/suspensao do ultimo owner
- aceite de convite por usuario com email diferente
- convites duplicados para membro ja ativo
- exposicao desnecessaria de emails fora do contexto administrativo

## Operacoes necessarias nesta fase

- convidar usuario por email
- listar convites pendentes do tenant
- aceitar convite autenticado por token
- listar membros do tenant
- alterar role de membro
- suspender membro
- remover membro

## Direcao arquitetural da fase

Para manter seguranca forte:

- o fluxo de convite deve ficar modelado no banco
- aceite de convite deve passar por funcao SQL ou endpoint seguro com validacao de email + token
- mutacoes de `memberships` nao devem ficar abertas genericamente por RLS
- regras criticas devem ficar no banco e nao apenas no frontend

## Conclusao

O NexusCRM ja esta pronto para virar SaaS colaborativo, mas falta a camada de lifecycle de membership:

- convite
- aceite
- administracao
- suspensao
- remocao

Esta fase deve fechar esse ciclo sem enfraquecer o isolamento conquistado nas fases anteriores.
