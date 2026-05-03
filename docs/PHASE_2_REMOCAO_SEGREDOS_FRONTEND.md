# Fase 2 - Remocao Completa do Modelo de Acesso por Segredo

Data: 2026-05-02

## Objetivo

Remover completamente o modelo de acesso por segredo compartilhado no frontend, sem fallback legado e sem compatibilidade simultanea com auth + segredo.

## Decisao Aplicada

Nesta fase, o frontend deixa de depender de:

- `VITE_WORKSPACE_ACCESS_SECRET`
- `VITE_BOT_CONFIG_SECRET`
- `X-Workspace-Key`
- `X-Bot-Config-Key`
- `WorkspaceGate`
- `BotAdminGate`
- `sessionStorage` usado como pseudo-auth

Qualquer dependencia remanescente desse modelo foi tratada como bug e removida do codigo ativo.

## Implementacoes Realizadas

### 1. Novo transporte autenticado por sessao

Foi criada a camada `src/lib/apiFetch.js`, que:

- usa a sessao atual do Supabase Auth
- le o `access_token` real
- envia `Authorization: Bearer <token>`
- falha explicitamente quando nao existe sessao autenticada

Com isso, o frontend nao envia mais nenhum segredo de workspace ou segredo administrativo.

### 2. Gate de sessao real no frontend

Foi criado `src/components/AuthSessionGate.jsx`.

Esse componente:

- valida a sessao atual via `supabase.auth.getSession()`
- observa mudancas de auth com `onAuthStateChange`
- renderiza a aplicacao apenas quando existe sessao autenticada
- bloqueia o acesso quando nao existe sessao

Observacao:
Nesta fase ainda nao existe fluxo completo de login/signup. O app agora exige sessao real, e a UI completa de autenticacao sera implementada na Fase 3.

### 3. Remocao do gate legado por segredo

Foram removidos do fluxo principal:

- `src/components/WorkspaceGate.jsx`
- `src/components/Settings/BotAdminGate.jsx`
- `src/lib/workspaceAccess.js`
- `src/lib/botAdmin.js`

Tambem foi removida a injecao do segredo no bundle em `vite.config.js`.

### 4. Migracao dos clients HTTP do frontend

Os seguintes modulos passaram a usar `authenticatedFetch`:

- `src/lib/workspaceCore.js`
- `src/lib/botConfig.js`
- `src/lib/botCommands.js`

Nao ha mais chamadas ativas usando os fetchers legados por segredo.

### 5. Backend ajustado para bearer auth

Foi criado `supabase/functions/_shared/auth.ts` para validar usuario autenticado via header `Authorization`.

As seguintes Edge Functions deixaram de depender de segredo compartilhado e passaram a exigir sessao autenticada:

- `supabase/functions/workspace-core/index.ts`
- `supabase/functions/bot-config/index.ts`
- `supabase/functions/bot-commands/index.ts`

Tambem foi removido `supabase/functions/_shared/workspace-auth.ts`.

### 6. CORS alinhado ao novo modelo

`supabase/functions/_shared/cors.ts` foi atualizado para permitir `Authorization` em vez dos headers legados.

### 7. Configuracao Vite limpa

`vite.config.js` foi simplificado:

- sem `loadEnv`
- sem `__WORKSPACE_ACCESS_SECRET__`
- sem uso de `process.cwd()`

Efeito colateral positivo:

- o erro conhecido de lint em `vite.config.js` deixou de existir

## Arquivos Criados

- `src/lib/apiFetch.js`
- `src/lib/apiFetch.test.js`
- `src/components/AuthSessionGate.jsx`
- `src/components/AuthSessionGate.test.jsx`
- `supabase/functions/_shared/auth.ts`

## Arquivos Alterados

- `src/main.jsx`
- `src/components/Settings/SettingsView.jsx`
- `src/lib/workspaceCore.js`
- `src/lib/botConfig.js`
- `src/lib/botCommands.js`
- `vite.config.js`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/workspace-core/index.ts`
- `supabase/functions/bot-config/index.ts`
- `supabase/functions/bot-commands/index.ts`

## Arquivos Removidos

- `src/components/WorkspaceGate.jsx`
- `src/components/Settings/BotAdminGate.jsx`
- `src/lib/workspaceAccess.js`
- `src/lib/botAdmin.js`
- `supabase/functions/_shared/workspace-auth.ts`

## Verificacao Executada

### Busca por dependencias legadas no codigo ativo

Comando:

```bash
rg -n "WorkspaceGate|BotAdminGate|workspaceFetch|botAdminFetch|X-Workspace-Key|X-Bot-Config-Key|VITE_WORKSPACE_ACCESS_SECRET|VITE_BOT_CONFIG_SECRET|workspace_secret|bot_admin_secret" src supabase vite.config.js
```

Resultado:

- nenhuma ocorrencia encontrada no codigo ativo

### Testes

Comando:

```bash
npm test
```

Resultado:

- 8 arquivos de teste passaram
- 61 testes passaram

Inclui os novos testes de:

- `src/lib/apiFetch.test.js`
- `src/components/AuthSessionGate.test.jsx`

### Build

Comando:

```bash
npm run build
```

Resultado:

- build concluido com sucesso

Observacao:

- warning de chunk grande permanece e nao foi tratado nesta fase

### Lint

Comando:

```bash
npm run lint
```

Resultado:

- lint concluido com sucesso

## Estado Atual ao Final da Fase 2

- O frontend nao usa mais segredo compartilhado como mecanismo de acesso.
- O backend principal inspecionado nao aceita mais os headers legados como forma de autenticacao.
- O app agora depende exclusivamente de sessao real do Supabase Auth para acesso aos endpoints migrados nesta fase.

## Limitacoes Conhecidas Ate a Fase 3

- Ainda nao existe UI completa de autenticacao com login/signup/logout.
- O gate atual apenas exige sessao autenticada; ele nao oferece ainda a tela de login.
- `workspace-core`, `bot-config` e `bot-commands` ainda operam com backend privilegiado internamente; a remocao de `service_role` para operacoes comuns sera tratada nas fases de tenancy e RLS.
- Como ainda nao existe multi-tenancy nem roles, qualquer usuario autenticado podera alcancar os endpoints migrados, dentro das limitacoes atuais da base.

## Resultado da Fase 2

- O modelo por segredo foi removido completamente do frontend e do fluxo ativo dos endpoints migrados.
- Nenhum fallback legado foi mantido.
- A base esta pronta para a Fase 3, onde sera implementada a autenticacao real completa com telas, rotas protegidas e sessao persistente.
