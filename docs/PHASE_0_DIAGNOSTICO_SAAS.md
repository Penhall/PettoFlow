# Fase 0 - Diagnostico Inicial do Repositorio

Data: 2026-05-02

## Objetivo

Avaliar a base atual do projeto para definir o que pode ser reaproveitado com seguranca e o que precisa ser reconstruido para formar o core SaaS do NexusCRM.

## Decisao Arquitetural

O projeto NAO sera evoluido como extensao direta da arquitetura atual.

Sera adotada uma abordagem de "SaaS Core separado", onde:

- A camada de autenticacao, tenancy e autorizacao sera reconstruida do zero.
- O frontend e a logica de dominio serao reaproveitados progressivamente.
- O backend atual sera desacoplado e modularizado ao longo do processo.
- Nenhuma funcionalidade de negocio sera migrada sem antes estar dentro do contexto de tenant.

Motivo:
Evitar divida tecnica estrutural e garantir base SaaS segura e escalavel.

## Arquitetura Atual

- Frontend SPA em React 18 + Vite.
- Backend principal em Supabase Edge Functions com foco em `workspace-core`.
- Banco em PostgreSQL via Supabase.
- Integracoes externas com Telegram e LLMs.
- Estilo em CSS puro, sem design system formal.
- Parte relevante da logica de negocio esta dividida entre hooks React, helpers em `src/lib` e funcoes Edge.

## Estrutura Relevante

- `src/App.jsx`: orquestrador principal do app.
- `src/components/`: modulos visuais de tarefas, clientes, atividades, financas, calendario e settings.
- `src/hooks/`: camada de acesso e orquestracao do frontend.
- `src/lib/`: cliente Supabase, auth por segredo, helpers financeiros, clients HTTP.
- `supabase/functions/workspace-core/`: BFF concentrando varios dominios.
- `supabase/functions/telegram-webhook/`: integracao operacional com Telegram.
- `supabase/functions/bot-config/` e `bot-commands/`: configuracao do bot.
- `supabase/migrations/`: migrations recentes de endurecimento de RLS e bot commands.

## Pontos Seguros Para Reaproveitamento

- UX geral do produto e organizacao visual.
- Componentes de CRM, tarefas, atividades, calendario e financas.
- Parte da logica de dominio em `financeUtils.js`, `rulesEngine.js` e fluxos de recebiveis.
- Testes existentes de regras e componentes.
- Integracao Telegram como referencia funcional.

## Pontos Que Devem Ser Reescritos

- Modelo de autenticacao atual baseado em segredo compartilhado.
- `WorkspaceGate` e `workspaceAccess.js`.
- `botAdmin.js` e fluxo de segredo administrativo no frontend.
- Modelo de dados sem `tenant_id` ou `workspace_id`.
- Politicas de acesso baseadas em `service_role` para operacoes comuns.
- `workspace-core` como endpoint monolitico para varios dominios.

## Riscos Imediatos

- Segredos de acesso visiveis ao cliente via `VITE_WORKSPACE_ACCESS_SECRET` e `VITE_BOT_CONFIG_SECRET`.
- Sem login real por usuario.
- Sem isolamento multi-tenant.
- Queries de negocio sem escopo por tenant.
- Uso central de `SUPABASE_SERVICE_ROLE_KEY`.
- Documentacao desatualizada em relacao ao estado real do RLS.
- `npm run lint` falha em `vite.config.js`.
- `npm run test:deno` depende de Deno instalado localmente.

## Priorizacao de Riscos

### Criticos

- Modelo de acesso por segredo compartilhado no frontend.
- Ausencia de autenticacao real por usuario.
- Ausencia de `tenant_id` nas entidades centrais.
- RLS nao orientado por `auth.uid()` e membership.
- Uso amplo de `service_role` para operacoes de negocio.

### Altos

- `workspace-core` concentrando varios dominios e regras de acesso.
- Integracao Telegram dependente de configuracao global e sem isolamento por tenant.
- Falta de onboarding de workspace e fluxo de criacao de tenant.
- Ausencia de sistema formal de roles e permissoes.

### Medios

- Drift entre documentacao e implementacao real.
- Falta de CI/CD e validacao automatizada de migrations e functions.
- Dependencias potencialmente nao utilizadas no runtime atual.
- Lint quebrado e dependencias locais ausentes para alguns testes.

### Baixos

- Branding interno ainda com nome legado.
- CSS e arquivos grandes, mas sem bloquear a reconstrucao do core SaaS.

## Arquivos Criticos

- `src/lib/workspaceAccess.js`
- `src/components/WorkspaceGate.jsx`
- `src/lib/botAdmin.js`
- `src/App.jsx`
- `src/components/Settings/SettingsView.jsx`
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/_shared/workspace-auth.ts`
- `supabase/functions/workspace-core/index.ts`
- `supabase/functions/bot-config/index.ts`
- `supabase/functions/bot-commands/index.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/migrations/20260405000000_harden_core_tables.sql`
- `vite.config.js`

## Sinais de Maturidade

- `npm test`: passou com 56 testes.
- `npm run build`: passou.
- `npm run lint`: falhou por configuracao.
- A base funcional existe e ja cobre casos de uso reais.

## Estado Alvo

- Autenticacao real com Supabase Auth para signup, login, logout e sessao persistida.
- Modelo multi-tenant explicito com `tenants`, `memberships` e `tenant_settings`.
- Todas as entidades de negocio com `tenant_id` e indices correspondentes.
- RLS baseado em `auth.uid()` e membership `active`.
- Frontend com contexto de tenant, selecao de workspace e onboarding inicial.
- Operacoes comuns executadas via cliente Supabase com RLS, e nao via `service_role`.
- Edge Functions restritas a integracoes, automacoes privilegiadas e workflows controlados.
- Integracao Telegram isolada por tenant, com configuracoes sensiveis fora do frontend.
- Base preparada para billing, observabilidade, CI/CD e operacao em ambientes separados.

## Guardrails Para As Proximas Fases

- Nao portar nenhum endpoint legado para o novo fluxo sem validar tenancy antes.
- Nao manter compatibilidade com `X-Workspace-Key` como mecanismo definitivo de acesso.
- Nao introduzir `tenant_id` apenas no frontend ou apenas visualmente.
- Nao usar `service_role` como atalho para CRUD comum de usuario autenticado.
- Nao migrar Telegram ou billing antes de estabilizar auth, tenancy e RLS.
- Nao remover funcionalidades uteis do produto sem mapeamento explicito de substituicao.
- Toda migracao de dados legados deve criar um tenant default documentado e rastreavel.

## Ordem Recomendada de Implementacao

1. Renomeacao visivel para NexusCRM sem quebrar identificadores internos.
2. Remocao do modelo de acesso por segredo no frontend.
3. Introducao de autenticacao real com Supabase Auth.
4. Criacao do modelo SaaS com `tenants`, `memberships` e `tenant_settings`.
5. Adicao de `tenant_id` nas entidades de negocio com estrategia de migracao.
6. RLS real por tenant e membership.
7. Contexto de tenant no frontend.
8. Onboarding de workspace.
9. Refatoracao progressiva do backend e reducao do `workspace-core`.
10. Reestruturacao multi-tenant do Telegram.
11. Preparacao de billing.
12. CI, qualidade e documentacao final.

## Recomendacao de Execucao

- Evolucao incremental e verificavel.
- Priorizar seguranca e isolamento de dados antes de migrar fluxos avancados.
- Reaproveitar interface e logica de dominio, mas reconstruir auth, tenancy e autorizacao corretamente.

## Resultado da Fase 0

- Diagnostico concluido.
- Nenhuma alteracao funcional aplicada.
- Base pronta para iniciar a Fase 1 com risco controlado.
