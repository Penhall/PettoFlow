# Telegram Bot — PettoFlow Design Spec

**Data:** 2026-03-31  
**Status:** Aprovado  
**Stack:** React 18 + Vite + JavaScript · Supabase (PostgreSQL + Edge Functions) · Claude Haiku (LLM fallback)

---

## 1. Visão Geral

Integração bidirecional entre o PettoFlow e o Telegram, permitindo que o usuário crie tarefas, registre atividades e lance transações financeiras diretamente pelo Telegram usando slash commands e linguagem natural.

**Não** é um serviço externo independente. Tudo roda dentro da infraestrutura Supabase existente — zero servidor adicional para v1.

**Porta aberta para o futuro:** arquitetura compatível com Hermes Agent (NousResearch) via MCP — o action layer interno pode ser exposto como servidor MCP sem reescrever lógica de negócio.

---

## 2. Arquitetura

```
Usuário (Telegram)
        │  mensagem ou /comando
        ▼
Supabase Edge Function: telegram-webhook
        │
        ├── [Segurança] webhook_secret header → 401 se inválido
        ├── [Segurança] allowed_telegram_ids → silêncio se não autorizado
        ├── [Segurança] is_active flag → resposta de "pausado" se false
        │
        ├── [Parse] começa com "/" → regex parser → action direta
        └── [Parse] texto livre → Claude Haiku (function calling) → action estruturada
                │
                ▼
        Action Layer (funções internas)
        tasks.create / tasks.list / tasks.complete / tasks.setPriority
        activities.log / activities.list
        finance.record / finance.balance / finance.list
                │
                ▼
        Supabase DB (tabelas existentes: tasks, activities, transactions, accounts)
                │
                ▼
        Edge Function envia resposta ao Telegram (sendMessage API)
```

**Settings page (React, novo módulo):** usuário cola o bot token → PettoFlow registra o webhook automaticamente via Telegram Bot API → bot ativo em segundos.

---

## 3. Modelo de Dados

### 3.1 Nova tabela: `bot_configs`

```sql
CREATE TABLE bot_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_bot_token     TEXT NOT NULL,         -- criptografado AES-256-GCM
  webhook_secret         TEXT NOT NULL,         -- criptografado AES-256-GCM
  allowed_telegram_ids   TEXT[] DEFAULT '{}',   -- allowlist de user IDs
  is_active              BOOLEAN DEFAULT true,
  confirmation_threshold NUMERIC DEFAULT 500.00, -- valor mínimo para pedir confirmação
  llm_api_key            TEXT,                  -- criptografado, opcional
  llm_provider           TEXT DEFAULT 'anthropic', -- 'anthropic' | 'openai'
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
```

**v1:** single-row (usuário único). Preparada para multi-usuário com `user_id UUID REFERENCES auth.users` quando autenticação for implementada.

**Criptografia:** AES-256-GCM via Web Crypto API (disponível no runtime Deno das Edge Functions). A `ENCRYPTION_KEY` é uma variável de ambiente da Edge Function — nunca armazenada no banco.

### 3.2 Nova tabela: `bot_pending_confirmations`

```sql
CREATE TABLE bot_pending_confirmations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        TEXT NOT NULL,      -- Telegram chat_id aguardando resposta
  action_type    TEXT NOT NULL,      -- ex: 'finance.record'
  action_payload JSONB NOT NULL,     -- payload completo da ação
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

Fluxo: transação > `confirmation_threshold` → Edge Function salva aqui e pergunta "SIM ou NÃO?" → próxima mensagem "SIM" → executa e deleta o registro → "NÃO" ou silêncio por 5 min → deleta e cancela.

### 3.3 Tabelas existentes — sem alteração

- `tasks` — `title`, `status`, `priority`, `tags`, `due_date`, `completed_at`
- `activities` — `type` (meeting/call/note), `body`, `status`, `scheduled_at`  
  → reuniões e ligações criadas via Telegram usam `scheduled_at` e aparecem automaticamente no Calendário
- `transactions` — `amount`, `date`, `payee_id`, `category_id`, `notes`
- `accounts` — lido para `/saldo`

---

## 4. Comandos v1

### 4.1 Tarefas

| Comando | Ação |
|---|---|
| `/tarefa [título]` | Cria tarefa com status "a fazer" |
| `/tarefas` | Lista tarefas por status (a fazer / em progresso / concluído), máx 5 por status |
| `/ok [número]` | Conclui tarefa pelo número da última listagem |
| `/prioridade [número] [alta\|média\|baixa]` | Define prioridade da tarefa |

### 4.2 Atividades

| Comando | Ação |
|---|---|
| `/nota [texto]` | Cria activity type=note com body.text |
| `/reuniao [hora] [tema]` | Cria activity type=meeting com scheduled_at |
| `/ligacao [para quem]` | Cria activity type=call |
| `/atividades` | Lista últimas 5 atividades |

> **Nota sobre acentos:** Telegram não aceita acentos em slash commands — os comandos são `/reuniao` e `/ligacao`. O parser deve normalizar entradas com acento (`/reunião`, `/ligação`) antes de fazer o match.

> `/reuniao` e `/ligacao` definem `scheduled_at` → evento aparece automaticamente no CalendarView existente.

### 4.3 Finanças

| Comando | Ação |
|---|---|
| `/pagar [descrição] [valor]` | Registra transação de saída na conta principal |
| `/recebi [descrição] [valor]` | Registra transação de entrada na conta principal |
| `/saldo` | Retorna saldo atual de cada conta ativa |
| `/extrato` | Lista últimas 5 transações com valor e categoria |

> Transações com `valor > confirmation_threshold` disparam fluxo de confirmação via `bot_pending_confirmations`.

### 4.4 Globais

| Comando | Resposta |
|---|---|
| `/start` | Boas-vindas + detecta e registra o Telegram ID do usuário |
| `/ajuda` | Lista todos os comandos disponíveis |
| `/status` | Informa que o bot está ativo e mostra versão |

### 4.5 LLM Fallback (mensagens sem `/`)

Mensagens em texto livre são enviadas ao Claude Haiku com:
- System prompt descrevendo os módulos e ações disponíveis
- Function calling com schemas para cada action do action layer
- Instrução para retornar `{action, params}` ou `{error: "não_entendido"}`

O LLM **não executa** ações diretamente — retorna JSON estruturado que a Edge Function valida contra a allowlist de ações antes de executar.

**Custo estimado:** ~$0,001 por mensagem NL (Claude Haiku). Slash commands custam $0.

---

## 5. Regras de Negócio

1. **Confirmação de transações grandes:** valor > `confirmation_threshold` (default R$500, configurável) → bot pergunta → aguarda "SIM"/"NÃO" por 5 minutos → sem resposta cancela automaticamente.

2. **Listagem paginada:** `/tarefas` retorna máx 5 itens por status com numeração sequencial. `/ok 3` conclui o item #3 da última listagem enviada naquele chat. O mapeamento número→ID de tarefa é armazenado em `bot_pending_confirmations` com `action_type = 'task_list_context'` e expira em 30 minutos — reutilizando a tabela de confirmações pendentes para não precisar de nova estrutura.

3. **Feedback obrigatório:** toda ação retorna confirmação explícita (✅ sucesso) ou erro amigável (❌ com sugestão de sintaxe correta).

4. **Slash commands são regex puro:** nunca passam pelo LLM — zero latência extra, zero custo de API.

5. **Calendário automático:** atividades criadas via Telegram com `scheduled_at` aparecem no CalendarView sem código adicional.

---

## 6. Segurança

### Camada 1 — Autenticação do webhook
Header `X-Telegram-Bot-Api-Secret-Token` validado contra `webhook_secret` do banco. Requests inválidos → 401, descartados sem log visível ao remetente.

### Camada 2 — Allowlist de usuários  
`from.id` verificado contra `allowed_telegram_ids`. IDs não autorizados → 200 (não revela existência do bot) + sem ação.

### Camada 3 — Bot ativo
`is_active = false` → resposta amigável de pausa. O usuário pode pausar/retomar pelo Settings sem reconfigurar.

### Camada 4 — Allowlist de ações
A Edge Function mantém um Set fixo de actions permitidas. Output do LLM com action fora da allowlist é rejeitado — o LLM não pode invocar nada arbitrário.

### Criptografia de tokens
AES-256-GCM via Web Crypto API no runtime Deno. `ENCRYPTION_KEY` como env var da Edge Function. Tokens nunca trafegam descriptografados fora da Edge Function.

---

## 7. Tratamento de Erros

| Situação | Resposta ao Telegram |
|---|---|
| Comando não reconhecido | "Não entendi 🤔 Tente /ajuda" |
| Parâmetros incompletos | "Faltou o valor! Ex: `/pagar luz 150`" |
| Erro no banco | "Algo deu errado. Tente novamente em instantes." |
| LLM indisponível | Tenta regex fallback; se falhar: "Serviço temporariamente indisponível." |
| Confirmação expirada | "Confirmação expirada. Envie o comando novamente se quiser registrar." |
| Bot pausado | "Bot pausado. Reative nas Configurações do PettoFlow." |
| ID não autorizado | _(sem resposta)_ |

---

## 8. Settings Page (React)

### Navegação
Novo item "⚙️ Configurações" no Sidebar, última posição.

### Estado: primeiro acesso — Onboarding Wizard
4 passos sequenciais:
1. Abrir @BotFather no Telegram e criar bot com `/newbot`
2. Copiar o token gerado
3. Colar token no campo + botão "Conectar" → PettoFlow registra webhook automaticamente
4. Enviar `/start` ao bot → ID Telegram detectado e adicionado à allowlist automaticamente

### Estado: configurado
- Badge "● Ativo" (verde) ou "● Pausado" (cinza) com botão de toggle
- Token mascarado com botão "Trocar token"
- Allowlist de IDs com add/remove inline
- Campo editável para `confirmation_threshold` (R$)
- Seção colapsável para LLM API key (opcional)

### Componentes novos
- `src/components/Settings/SettingsView.jsx` — container principal com tabs
- `src/components/Settings/TelegramSection.jsx` — toda a lógica de configuração do bot
- `src/components/Settings/OnboardingWizard.jsx` — 4 passos de setup
- `src/lib/botConfig.js` — CRUD de `bot_configs` via Supabase JS
- `src/lib/crypto.js` — encrypt/decrypt com Web Crypto API (browser-side para o token antes de enviar)

---

## 9. Supabase Edge Function

**Nome:** `telegram-webhook`  
**Runtime:** Deno  
**Arquivo:** `supabase/functions/telegram-webhook/index.ts`

**Estrutura interna:**
```
index.ts           — entry point, roteamento
middleware/
  auth.ts          — validação webhook_secret + allowlist
actions/
  tasks.ts         — tasks.create, tasks.list, tasks.complete, tasks.setPriority  
  activities.ts    — activities.log, activities.list
  finance.ts       — finance.record, finance.balance, finance.list
parser/
  slash.ts         — regex parser para slash commands
  nlp.ts           — LLM fallback via Anthropic API
  allowlist.ts     — Set de actions permitidas
telegram/
  send.ts          — sendMessage wrapper
  webhook.ts       — registro automático do webhook
utils/
  crypto.ts        — AES-256-GCM encrypt/decrypt
  confirm.ts       — fluxo de confirmação (bot_pending_confirmations)
```

**Variáveis de ambiente necessárias:**
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (automáticas no Supabase)
- `ENCRYPTION_KEY` — chave AES-256 (gerada uma vez, armazenada como secret)
- `ANTHROPIC_API_KEY` — fallback para desenvolvimento local. Em produção, a Edge Function lê a LLM key do campo `llm_api_key` do banco (fornecida pelo usuário nas Settings, descriptografada em memória). Env var só é usada se o banco não tiver key configurada.

---

## 10. Fora de Escopo (v1)

- Multi-usuário / autenticação (estrutura preparada, não implementada)
- Hermes Agent (porta MCP deixada aberta na arquitetura)
- Comandos de Clientes e Time via Telegram
- Notificações proativas (Telegram → usuário sem comando iniciado pelo usuário)
- Export de dados via bot
- Integração WhatsApp

---

## 11. Plano de Implementação (alto nível)

1. **SQL migration** — criar `bot_configs` e `bot_pending_confirmations`
2. **Edge Function** — `telegram-webhook` com parser, actions e segurança
3. **Settings page** — `SettingsView`, `TelegramSection`, `OnboardingWizard`
4. **Sidebar** — adicionar item "Configurações"
5. **Testes** — unit para parser, integração para fluxo de confirmação

Cada etapa é independente e pode ser revisada antes de continuar.
