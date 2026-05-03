# Fase 2 - Diagnostico Especifico de Auth

Data: 2026-05-02

## Objetivo

Registrar o estado atual do controle de acesso apos a remocao do modelo por segredo e definir o plano incremental para concluir a fundacao de autenticacao real com Supabase Auth.

## Arquivos que controlam acesso atualmente

- `src/main.jsx`: injeta `AuthSessionGate` acima do `App`.
- `src/components/AuthSessionGate.jsx`: gate temporario que exige sessao existente, mas ainda nao oferece login, cadastro ou logout.
- `src/lib/supabaseClient.js`: cria o cliente Supabase com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `src/lib/apiFetch.js`: obtém a sessao atual e envia `Authorization: Bearer <token>` para os endpoints migrados.
- `supabase/functions/_shared/auth.ts`: valida usuario autenticado nas Edge Functions migradas.

## Onde `WorkspaceGate` e `BotAdminGate` sao usados

- `WorkspaceGate`: nao possui mais uso ativo no repositorio.
- `BotAdminGate`: nao possui mais uso ativo no repositorio.

## Onde `workspaceAccess` e `botAdmin` sao importados

- `workspaceAccess`: nenhuma importacao ativa encontrada.
- `botAdmin`: nenhuma importacao ativa encontrada.

## Onde segredos e headers legados aparecem

- `VITE_WORKSPACE_ACCESS_SECRET`: nenhuma ocorrencia ativa encontrada.
- `VITE_BOT_CONFIG_SECRET`: nenhuma ocorrencia ativa encontrada.
- `X-Workspace-Key`: nenhuma ocorrencia ativa encontrada.
- `X-Bot-Config-Key`: nenhuma ocorrencia ativa encontrada.

## Endpoints que ficam perigosos se liberados apenas por sessao autenticada

- `supabase/functions/bot-config/index.ts`: opera configuracao global do bot.
- `supabase/functions/bot-commands/index.ts`: opera comandos administrativos globais do bot.
- `supabase/functions/workspace-core/index.ts`: ja exige sessao, mas ainda usa backend privilegiado internamente e ainda nao possui tenant, membership nem roles.

Risco principal:
- sem roles e sem tenant, trocar o segredo por "qualquer usuario autenticado" so desloca o problema e abre administracao global para qualquer conta valida.

## Impacto esperado da remocao definitiva do modelo legado

- o app deixa de depender de prompt de segredo e passa a depender apenas de sessao real;
- `AuthSessionGate` deixa de ser suficiente e precisa ser substituido por fluxo completo de auth;
- modulos ainda administrativos, especialmente Telegram, nao devem continuar operando normalmente ate existir autorizacao adequada.

## Plano incremental de edicao

1. Criar este diagnostico e usá-lo como base da fase.
2. Substituir `AuthSessionGate` por `AuthProvider`, `useAuth` e `ProtectedRoute`.
3. Criar `LoginPage`, `SignupPage` e `AuthLayout` com branding NexusCRM.
4. Integrar logout no header e manter sessao persistida pelo Supabase.
5. Bloquear temporariamente as areas de configuracao avancada do Telegram e comandos administrativos.
6. Atualizar documentacao de env para manter apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend.
7. Executar `npm test`, `npm run build`, `npm run lint` e busca textual final por dependencias legadas.

## Estado desejado ao final da fase

- acesso ao dashboard somente com sessao valida do Supabase Auth;
- login, cadastro e logout disponiveis no frontend;
- nenhum segredo legado no fluxo ativo;
- nenhuma superficie administrativa global liberada apenas por autenticacao simples;
- base pronta para a proxima fase de tenancy, memberships e autorizacao real.
