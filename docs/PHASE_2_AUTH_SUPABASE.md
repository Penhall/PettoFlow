# Fase 2 - Auth Real com Supabase

Data: 2026-05-02

## Objetivo

Concluir a transicao do NexusCRM de "app protegido por segredo compartilhado" para "app protegido por sessao real de usuario via Supabase Auth", sem fallback legado e sem avancar para tenancy nesta fase.

## Alteracoes realizadas

### 1. Auth real no frontend

Foi criada a fundacao de autenticacao com:

- `src/context/AuthContext.jsx`
- `src/context/authContext.js`
- `src/hooks/useAuth.js`
- `src/components/auth/AuthLayout.jsx`
- `src/components/auth/LoginPage.jsx`
- `src/components/auth/SignupPage.jsx`
- `src/components/auth/ProtectedRoute.jsx`

O app agora:

- carrega a sessao inicial com `supabase.auth.getSession()`
- acompanha mudancas com `onAuthStateChange`
- exige sessao valida para abrir o dashboard
- oferece login, cadastro e logout na interface

### 2. Substituicao do gate temporario

`src/main.jsx` deixou de usar `AuthSessionGate` e passou a usar:

- `AuthProvider`
- `ProtectedRoute`

`AuthSessionGate` e seu teste foram removidos do fluxo e do repositorio.

### 3. Logout visivel no app

`src/components/Header.jsx` passou a consumir `useAuth()` e expor logout direto no cabecalho, junto com o email da sessao atual.

### 4. Cliente Supabase do frontend mantido no escopo correto

`src/lib/supabaseClient.js` continua limitado a:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nenhum segredo administrativo foi reintroduzido no frontend.

### 5. Bloqueio temporario de superficies globais do Telegram

Como ainda nao existem tenants, memberships e roles, as superficies administrativas globais do Telegram foram bloqueadas por seguranca:

- `src/components/Settings/TelegramSection.jsx`
- `src/components/Settings/CommandsSection.jsx`
- `supabase/functions/bot-config/index.ts`
- `supabase/functions/bot-commands/index.ts`

Em vez de liberar administracao global para qualquer usuario autenticado, a fase retorna mensagem clara de reestruturacao futura.

### 6. Documentacao publica de ambiente

`README.md` foi atualizado para instruir apenas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O README deixa explicito que o acesso nao depende mais de segredo compartilhado.

## Arquivos criados

- `docs/PHASE_2_AUTH_DIAGNOSTICO.md`
- `src/context/AuthContext.jsx`
- `src/context/authContext.js`
- `src/hooks/useAuth.js`
- `src/hooks/useAuth.test.jsx`
- `src/components/auth/AuthLayout.jsx`
- `src/components/auth/LoginPage.jsx`
- `src/components/auth/SignupPage.jsx`
- `src/components/auth/ProtectedRoute.jsx`
- `src/components/auth/ProtectedRoute.test.jsx`

## Arquivos modificados

- `src/main.jsx`
- `src/components/Header.jsx`
- `src/lib/supabaseClient.js`
- `src/components/Settings/TelegramSection.jsx`
- `src/components/Settings/CommandsSection.jsx`
- `src/components/Settings/__tests__/TelegramSection.test.jsx`
- `src/components/Settings/__tests__/CommandsSection.test.jsx`
- `supabase/functions/bot-config/index.ts`
- `supabase/functions/bot-commands/index.ts`
- `README.md`

## Arquivos removidos

- `src/components/AuthSessionGate.jsx`
- `src/components/AuthSessionGate.test.jsx`

## Fluxo atual de autenticacao

1. O frontend inicializa `AuthProvider`.
2. O provider carrega a sessao atual do Supabase Auth.
3. `ProtectedRoute` decide entre:
   - loading
   - configuracao incompleta
   - login
   - cadastro
   - dashboard autenticado
4. Depois do login ou signup com sessao ativa, o app libera `App.jsx`.
5. O logout no header encerra a sessao e devolve o usuario para a tela de auth.

## O que foi removido do modelo legado

- gate principal por segredo
- gate administrativo por segredo
- dependencia de `AuthSessionGate`
- fluxo ativo baseado em `workspace secret`
- fluxo ativo baseado em `bot admin secret`

Busca textual final em `src`, `supabase` e `vite.config.js` nao encontrou dependencias ativas de:

- `WorkspaceGate`
- `BotAdminGate`
- `workspaceAccess`
- `botAdmin`
- `X-Workspace-Key`
- `X-Bot-Config-Key`
- `VITE_WORKSPACE_ACCESS_SECRET`
- `VITE_BOT_CONFIG_SECRET`

## O que ainda permanece como legado

- `workspace-core` continua concentrando varios dominios e ainda usa backend privilegiado internamente
- `src/lib/botConfig.js` e `src/lib/botCommands.js` permanecem no repositorio, mas sem uso ativo nas telas bloqueadas desta fase
- ainda nao existe tenant, membership, role ou RLS por tenant

## O que ficou temporariamente bloqueado por seguranca

- configuracao avancada do Telegram
- gerenciamento de comandos administrativos do bot
- acesso frontend ativo a endpoints globais `bot-config` e `bot-commands`

Decisao aplicada:
- melhor bloquear do que transformar administracao global em recurso liberado a qualquer usuario autenticado

## Riscos pendentes

- qualquer usuario autenticado ainda compartilha o mesmo escopo funcional do `workspace-core`, porque tenancy e autorizacao granular ainda nao existem
- `workspace-core` continua centralizado e privilegiado
- o build ainda gera chunks acima de 500 kB
- o teste negativo de `useAuth` imprime stack esperada no output do Vitest, embora a suite passe

## Como testar

1. Configurar `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Rodar `npm run dev`.
3. Abrir o app deslogado e validar a tela "Entrar no NexusCRM".
4. Alternar para cadastro e criar conta.
5. Fazer login e confirmar acesso ao dashboard.
6. Recarregar a pagina e validar persistencia da sessao.
7. Usar o botao de logout no header.
8. Abrir Configuracoes e validar que Telegram e Comandos aparecem como bloqueados temporariamente.

## Resultado dos comandos

### `npm test`

- passou
- 9 arquivos de teste
- 56 testes aprovados

Observacao:
- o caso negativo de `useAuth` gera stack esperada no output, sem falha da suite

### `npm run lint`

- passou

### `npm run build`

- passou

Observacao:
- warning de chunk grande continua existente e nao foi tratado nesta fase

## Proxima fase recomendada

Fase 4 do plano SaaS:

- criar `tenants`
- criar `memberships`
- criar `tenant_settings`
- introduzir tenant context no backend e preparar a base para RLS real
