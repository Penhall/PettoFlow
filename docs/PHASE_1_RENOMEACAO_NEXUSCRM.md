# Fase 1 - Renomeacao Visivel para NexusCRM

Data: 2026-05-02

## Objetivo

Substituir o nome visivel ao usuario de `PettoFlow` para `NexusCRM`, sem alterar identificadores internos que possam quebrar imports, paths, configuracoes ou persistencia existente.

## Implementacoes Realizadas

### Metadados e identidade visual

- Titulo da aplicacao atualizado em `index.html`.
- Meta description adicionada com o nome `NexusCRM`.
- Nome exibido no sidebar alterado para `NexusCRM`.
- Monograma visual alterado de `PF` para `NC`.

### Textos publicos do frontend

- Loading screen alterada para `Carregando NexusCRM...`.
- Nome padrao da aplicacao alterado no fallback de titulo do app.
- Texto de configuracoes alterado para `Gerencie integrações e preferências do NexusCRM`.
- Texto do onboarding do Telegram alterado para mencionar `NexusCRM`.
- Status de conexao do Telegram alterado para `Telegram conectado ao NexusCRM`.
- Nome visivel do perfil lateral alterado para `Usuário NexusCRM`.
- Nome do arquivo exportado alterado para `nexuscrm-tarefas.csv`.

### Mensagens publicas do bot

- Mensagem de bot pausado alterada para `Configurações do NexusCRM`.
- Mensagem sobre voz/Gemini alterada para `Configurações do NexusCRM`.
- Saudacao inicial do bot alterada para `Sou o bot do NexusCRM`.
- Mensagem de status do bot alterada para `Bot ativo e conectado ao NexusCRM`.
- Mensagem de ausencia de conta financeira alterada para `Crie uma conta no NexusCRM`.

### Documentacao publica

- `DOCS.md` atualizado para `NexusCRM` no titulo e na visao geral.
- `README.md` publico criado com o nome `NexusCRM`, visao geral e comandos basicos.

## Arquivos Alterados

- `index.html`
- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Settings/SettingsView.jsx`
- `src/components/Settings/OnboardingWizard.jsx`
- `src/components/Settings/TelegramSection.jsx`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/actions/finance.ts`
- `DOCS.md`
- `README.md`

## Ocorrencias de "PettoFlow" que Permaneceram

### Mantidas por motivo tecnico

- `package.json`
  - `name: "pettoflow"` mantido por ser identificador interno do pacote.
- `src/context/ThemeContext.jsx`
  - `pettoflow_theme` mantido para nao quebrar preferencia de tema ja persistida no navegador.
- `src/lib/workspaceAccess.js`
  - `pettoflow_workspace_secret` mantido por ser chave interna de storage legado; sera removido na Fase 2.
- `src/lib/botAdmin.js`
  - `pettoflow_bot_admin_secret` mantido pelo mesmo motivo; sera tratado na Fase 2.
- `DOCS.md`
  - `pettoflow_theme` mantido apenas na descricao tecnica da chave real de armazenamento.

### Mantidas por serem documentos internos ou historicos

- `docs/superpowers/specs/*`
- `docs/superpowers/plans/*`
- `.impeccable.md`
- `supabase/functions/telegram-webhook/parser/nlp.ts`

Justificativa:
Esses arquivos sao historicos, tecnicos ou internos ao processo de desenvolvimento. Nao sao parte da interface publica do produto nem do branding visivel ao usuario final nesta fase.

## Verificacao Executada

### Testes

Comando:

```bash
npm test
```

Resultado:

- 6 arquivos de teste passaram
- 56 testes passaram

### Build

Comando:

```bash
npm run build
```

Resultado:

- build concluido com sucesso
- warning de chunk maior que 500 kB permanece

### Lint

Comando:

```bash
npm run lint
```

Resultado:

- falhou em `vite.config.js`
- erro existente: `process is not defined`

Observacao:
Essa falha ja existia antes da Fase 1 e nao foi introduzida pela renomeacao.

## Resultado da Fase 1

- Branding visivel ao usuario atualizado para `NexusCRM`.
- Nenhum identificador interno critico foi alterado cegamente.
- Base pronta para seguir para a Fase 2, focada na remocao do modelo de acesso por segredo no frontend.
