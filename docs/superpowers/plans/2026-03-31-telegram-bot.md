# Telegram Bot — PettoFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o PettoFlow ao Telegram via Supabase Edge Function, permitindo criar tarefas, registrar atividades e lançar transações por slash commands ou linguagem natural.

**Architecture:** Uma Supabase Edge Function (`telegram-webhook`) recebe webhooks do Telegram, valida segurança em 3 camadas, faz parse do comando (regex para slash commands, Claude Haiku para texto livre) e executa ações nas tabelas existentes do Supabase. Uma segunda Edge Function (`bot-config`) expõe CRUD seguro de configuração para o Settings page React.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript) · Supabase JS v2 · Telegram Bot API · Claude Haiku (LLM fallback) · React 18 + Vite · Vitest

---

## File Map

### Novos arquivos
```
supabase_bot.sql                                       ← migration das 2 novas tabelas
supabase/functions/_shared/crypto.ts                   ← AES-256-GCM encrypt/decrypt
supabase/functions/_shared/supabase.ts                 ← Supabase service-role client
supabase/functions/_shared/telegram.ts                 ← sendMessage + registerWebhook
supabase/functions/telegram-webhook/index.ts           ← entry point principal
supabase/functions/telegram-webhook/middleware/auth.ts ← 3 camadas de segurança
supabase/functions/telegram-webhook/parser/slash.ts    ← regex parser para /comandos
supabase/functions/telegram-webhook/parser/nlp.ts      ← LLM fallback (Claude Haiku)
supabase/functions/telegram-webhook/parser/allowlist.ts← Set de actions permitidas
supabase/functions/telegram-webhook/actions/tasks.ts   ← tasks.create/list/complete/setPriority
supabase/functions/telegram-webhook/actions/activities.ts ← activities.log/list
supabase/functions/telegram-webhook/actions/finance.ts ← finance.record/balance/list
supabase/functions/telegram-webhook/utils/confirm.ts   ← fluxo SIM/NÃO confirmação
supabase/functions/bot-config/index.ts                 ← CRUD de bot_configs para Settings
src/lib/botConfig.js                                   ← cliente React para bot-config API
src/components/Settings/SettingsView.jsx               ← container com tabs
src/components/Settings/TelegramSection.jsx            ← UI de configuração do bot
src/components/Settings/OnboardingWizard.jsx           ← 4 passos de setup inicial
src/components/Settings/__tests__/TelegramSection.test.jsx
```

### Arquivos modificados
```
src/components/Sidebar.jsx        ← adicionar item "Configurações"
src/App.jsx                       ← adicionar rota/estado para SettingsView
```

---

## Task 1: SQL Migration — Novas Tabelas

**Files:**
- Create: `supabase_bot.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase_bot.sql
-- Execute no Supabase Dashboard → SQL Editor

-- Tabela de configuração do bot (single-row para v1)
CREATE TABLE IF NOT EXISTS bot_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_bot_token     TEXT NOT NULL,
  webhook_secret         TEXT NOT NULL,
  allowed_telegram_ids   TEXT[] DEFAULT '{}',
  is_active              BOOLEAN DEFAULT true,
  confirmation_threshold NUMERIC DEFAULT 500.00,
  llm_api_key            TEXT,
  llm_provider           TEXT DEFAULT 'anthropic',
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Tabela de confirmações pendentes (transações grandes + contexto de listagem)
CREATE TABLE IF NOT EXISTS bot_pending_confirmations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida por chat_id
CREATE INDEX IF NOT EXISTS idx_bot_pending_chat_id ON bot_pending_confirmations(chat_id);

-- RLS: apenas service_role acessa (Edge Functions usam service_role key)
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_pending_confirmations ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas — acesso apenas via service_role (Edge Functions)
-- O Settings page acessa via bot-config Edge Function, não diretamente.
```

- [ ] **Step 2: Executar no Supabase**

Abra `https://supabase.com/dashboard/project/qzljsendvthfetrntwab/sql` e execute o arquivo acima. Verifique que as tabelas aparecem em `Table Editor`.

- [ ] **Step 3: Commit**

```bash
git add supabase_bot.sql
git commit -m "feat(db): add bot_configs and bot_pending_confirmations tables"
```

---

## Task 2: Estrutura de Diretórios + Utilitários Compartilhados

**Files:**
- Create: `supabase/functions/_shared/crypto.ts`
- Create: `supabase/functions/_shared/supabase.ts`
- Create: `supabase/functions/_shared/telegram.ts`

**Pré-requisito:** Instalar Supabase CLI se não tiver: `npm install -g supabase`

- [ ] **Step 1: Criar estrutura de diretórios**

```bash
mkdir -p supabase/functions/_shared
mkdir -p supabase/functions/telegram-webhook/middleware
mkdir -p supabase/functions/telegram-webhook/parser
mkdir -p supabase/functions/telegram-webhook/actions
mkdir -p supabase/functions/telegram-webhook/utils
mkdir -p supabase/functions/bot-config
mkdir -p src/components/Settings/__tests__
```

- [ ] **Step 2: Criar `supabase/functions/_shared/crypto.ts`**

Utilitário AES-256-GCM que roda no runtime Deno (Web Crypto API disponível nativamente).

```typescript
// supabase/functions/_shared/crypto.ts

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

function getKey(rawKey: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32))
  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await getKey(encryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  return `${ivB64}:${encB64}`
}

export async function decrypt(ciphertext: string, encryptionKey: string): Promise<string> {
  const [ivB64, encB64] = ciphertext.split(':')
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const encrypted = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0))
  const key = await getKey(encryptionKey)
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encrypted)
  return new TextDecoder().decode(decrypted)
}
```

- [ ] **Step 3: Criar `supabase/functions/_shared/supabase.ts`**

```typescript
// supabase/functions/_shared/supabase.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

export function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}
```

- [ ] **Step 4: Criar `supabase/functions/_shared/telegram.ts`**

```typescript
// supabase/functions/_shared/telegram.ts

export async function sendMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function registerWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
  })
  return res.json()
}

export async function deleteWebhook(botToken: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: 'POST',
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(functions): scaffold Edge Function structure + shared utilities"
```

---

## Task 3: Security Middleware

**Files:**
- Create: `supabase/functions/telegram-webhook/middleware/auth.ts`

- [ ] **Step 1: Escrever testes (Deno test runner)**

Crie o arquivo de teste temporário para verificar a lógica manualmente. Os testes rodam com `deno test` na pasta da função.

```typescript
// supabase/functions/telegram-webhook/middleware/auth.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { validateRequest } from './auth.ts'

const MOCK_CONFIG = {
  webhook_secret: 'test-secret',
  allowed_telegram_ids: ['123456'],
  is_active: true,
}

Deno.test('rejects request with wrong secret', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    body: JSON.stringify({ message: { from: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, false)
  assertEquals(result.status, 401)
})

Deno.test('rejects unauthorized telegram user', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 999999 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, false)
  assertEquals(result.status, 200) // silêncio para não revelar o bot
})

Deno.test('rejects when bot is paused', async () => {
  const pausedConfig = { ...MOCK_CONFIG, is_active: false }
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, pausedConfig)
  assertEquals(result.valid, false)
  assertEquals(result.paused, true)
})

Deno.test('accepts valid request', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 123456 }, chat: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, true)
})
```

- [ ] **Step 2: Implementar `auth.ts`**

```typescript
// supabase/functions/telegram-webhook/middleware/auth.ts

interface BotConfig {
  webhook_secret: string
  allowed_telegram_ids: string[]
  is_active: boolean
}

interface AuthResult {
  valid: boolean
  status?: number
  paused?: boolean
  body?: unknown
}

export async function validateRequest(
  req: Request,
  config: BotConfig
): Promise<AuthResult> {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== config.webhook_secret) {
    return { valid: false, status: 401 }
  }

  const body = await req.json()

  const fromId = String(body?.message?.from?.id ?? body?.callback_query?.from?.id ?? '')
  if (!config.allowed_telegram_ids.includes(fromId)) {
    return { valid: false, status: 200 } // silêncio
  }

  if (!config.is_active) {
    return { valid: false, status: 200, paused: true, body }
  }

  return { valid: true, body }
}
```

- [ ] **Step 3: Rodar os testes**

```bash
cd supabase/functions/telegram-webhook/middleware
deno test auth.test.ts
```

Esperado: 4 testes passando.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/telegram-webhook/
git commit -m "feat(functions): add security middleware with 3-layer validation"
```

---

## Task 4: Slash Command Parser + Testes

**Files:**
- Create: `supabase/functions/telegram-webhook/parser/slash.ts`
- Create: `supabase/functions/telegram-webhook/parser/slash.test.ts`

- [ ] **Step 1: Escrever os testes primeiro**

```typescript
// supabase/functions/telegram-webhook/parser/slash.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { parseSlash } from './slash.ts'

Deno.test('parse /tarefa', () => {
  assertEquals(parseSlash('/tarefa comprar ração'), {
    action: 'tasks.create',
    params: { title: 'comprar ração' },
  })
})

Deno.test('parse /tarefas', () => {
  assertEquals(parseSlash('/tarefas'), { action: 'tasks.list', params: {} })
})

Deno.test('parse /ok', () => {
  assertEquals(parseSlash('/ok 3'), { action: 'tasks.complete', params: { num: 3 } })
})

Deno.test('parse /prioridade', () => {
  assertEquals(parseSlash('/prioridade 2 alta'), {
    action: 'tasks.setPriority',
    params: { num: 2, priority: 'Alta' },
  })
})

Deno.test('parse /nota', () => {
  assertEquals(parseSlash('/nota liguei pro cliente'), {
    action: 'activities.log',
    params: { type: 'note', text: 'liguei pro cliente' },
  })
})

Deno.test('parse /reuniao with accent', () => {
  const result = parseSlash('/reunião 14h equipe')
  assertEquals(result?.action, 'activities.log')
  assertEquals(result?.params.type, 'meeting')
})

Deno.test('parse /pagar', () => {
  assertEquals(parseSlash('/pagar conta de luz 150'), {
    action: 'finance.record',
    params: { direction: 'out', description: 'conta de luz', amount: 150 },
  })
})

Deno.test('parse /pagar with comma decimal', () => {
  assertEquals(parseSlash('/pagar almoço 32,50'), {
    action: 'finance.record',
    params: { direction: 'out', description: 'almoço', amount: 32.5 },
  })
})

Deno.test('parse /recebi', () => {
  assertEquals(parseSlash('/recebi salário 3000'), {
    action: 'finance.record',
    params: { direction: 'in', description: 'salário', amount: 3000 },
  })
})

Deno.test('parse /saldo', () => {
  assertEquals(parseSlash('/saldo'), { action: 'finance.balance', params: {} })
})

Deno.test('returns null for non-slash message', () => {
  assertEquals(parseSlash('texto livre aqui'), null)
})

Deno.test('returns null for unknown command', () => {
  assertEquals(parseSlash('/desconhecido'), null)
})
```

- [ ] **Step 2: Verificar que os testes falham**

```bash
deno test supabase/functions/telegram-webhook/parser/slash.test.ts
```

Esperado: erro "Cannot resolve module './slash.ts'"

- [ ] **Step 3: Implementar `slash.ts`**

```typescript
// supabase/functions/telegram-webhook/parser/slash.ts

interface ParsedCommand {
  action: string
  params: Record<string, unknown>
}

function normalizeCommand(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function extractAmount(tokens: string[]): { amount: number; descTokens: string[] } | null {
  // Procura o último token que seja um número (ex: "150", "32,50", "1.200")
  for (let i = tokens.length - 1; i >= 0; i--) {
    const normalized = tokens[i].replace(',', '.')
    const num = parseFloat(normalized)
    if (!isNaN(num) && num > 0) {
      return { amount: num, descTokens: tokens.slice(0, i) }
    }
  }
  return null
}

const PRIORITY_MAP: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export function parseSlash(text: string): ParsedCommand | null {
  if (!text.startsWith('/')) return null

  const [rawCmd, ...rest] = text.slice(1).split(/\s+/)
  const cmd = normalizeCommand(rawCmd)
  const args = rest.join(' ').trim()

  switch (cmd) {
    case 'tarefa':
      if (!args) return null
      return { action: 'tasks.create', params: { title: args } }

    case 'tarefas':
      return { action: 'tasks.list', params: {} }

    case 'ok': {
      const num = parseInt(rest[0], 10)
      if (isNaN(num)) return null
      return { action: 'tasks.complete', params: { num } }
    }

    case 'prioridade': {
      const num = parseInt(rest[0], 10)
      const priorityKey = normalizeCommand(rest[1] ?? '')
      const priority = PRIORITY_MAP[priorityKey]
      if (isNaN(num) || !priority) return null
      return { action: 'tasks.setPriority', params: { num, priority } }
    }

    case 'nota':
      if (!args) return null
      return { action: 'activities.log', params: { type: 'note', text: args } }

    case 'reuniao':
      return { action: 'activities.log', params: { type: 'meeting', text: args } }

    case 'ligacao':
      return { action: 'activities.log', params: { type: 'call', text: args } }

    case 'atividades':
      return { action: 'activities.list', params: {} }

    case 'pagar': {
      const extracted = extractAmount(rest)
      if (!extracted) return null
      return {
        action: 'finance.record',
        params: {
          direction: 'out',
          description: extracted.descTokens.join(' '),
          amount: extracted.amount,
        },
      }
    }

    case 'recebi': {
      const extracted = extractAmount(rest)
      if (!extracted) return null
      return {
        action: 'finance.record',
        params: {
          direction: 'in',
          description: extracted.descTokens.join(' '),
          amount: extracted.amount,
        },
      }
    }

    case 'saldo':
      return { action: 'finance.balance', params: {} }

    case 'extrato':
      return { action: 'finance.list', params: {} }

    case 'start':
      return { action: 'bot.start', params: {} }

    case 'ajuda':
      return { action: 'bot.help', params: {} }

    case 'status':
      return { action: 'bot.status', params: {} }

    default:
      return null
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
deno test supabase/functions/telegram-webhook/parser/slash.test.ts
```

Esperado: 12 testes passando.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook/parser/
git commit -m "feat(functions): add slash command parser with tests"
```

---

## Task 5: Allowlist de Actions

**Files:**
- Create: `supabase/functions/telegram-webhook/parser/allowlist.ts`

- [ ] **Step 1: Criar `allowlist.ts`**

```typescript
// supabase/functions/telegram-webhook/parser/allowlist.ts

export const ALLOWED_ACTIONS = new Set([
  'tasks.create',
  'tasks.list',
  'tasks.complete',
  'tasks.setPriority',
  'activities.log',
  'activities.list',
  'finance.record',
  'finance.balance',
  'finance.list',
  'bot.start',
  'bot.help',
  'bot.status',
])

export function isAllowed(action: string): boolean {
  return ALLOWED_ACTIONS.has(action)
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/parser/allowlist.ts
git commit -m "feat(functions): add action allowlist for security"
```

---

## Task 6: Action Layer — Tarefas

**Files:**
- Create: `supabase/functions/telegram-webhook/actions/tasks.ts`

- [ ] **Step 1: Criar `actions/tasks.ts`**

Nota sobre statuses: os valores exatos vêm da tabela `kanban_columns`. O padrão instalado pela migration é `'A Fazer'`, `'Em Progresso'`, `'Concluído'`. Para `/tarefas`, buscamos todas as tarefas não arquivadas e agrupamos por status. Para `/ok`, buscamos o contexto de lista da `bot_pending_confirmations`.

```typescript
// supabase/functions/telegram-webhook/actions/tasks.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function createTask(
  sb: SupabaseClient,
  title: string
): Promise<string> {
  const { error } = await sb
    .from('tasks')
    .insert({ title, status: 'A Fazer', priority: 'Média' })
  if (error) throw error
  return `✅ Tarefa criada: <b>${title}</b>`
}

export async function listTasks(
  sb: SupabaseClient,
  chatId: string
): Promise<string> {
  const { data, error } = await sb
    .from('tasks')
    .select('id, title, status, priority')
    .is('archived_at', null)
    .not('status', 'eq', 'Concluído')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma tarefa pendente.'

  const grouped: Record<string, typeof data> = {}
  for (const task of data) {
    if (!grouped[task.status]) grouped[task.status] = []
    grouped[task.status].push(task)
  }

  let counter = 1
  const listContext: Array<{ num: number; id: string; title: string }> = []
  const lines: string[] = ['📋 <b>Tarefas:</b>']

  for (const [status, tasks] of Object.entries(grouped)) {
    lines.push(`\n<b>${status}</b>`)
    for (const task of tasks.slice(0, 5)) {
      lines.push(`  ${counter}. ${task.title} [${task.priority}]`)
      listContext.push({ num: counter, id: task.id, title: task.title })
      counter++
    }
  }

  lines.push('\nUse /ok [número] para concluir.')

  // Salva contexto de numeração (expira em 30 min)
  await sb.from('bot_pending_confirmations').delete().eq('chat_id', chatId).eq('action_type', 'task_list_context')
  await sb.from('bot_pending_confirmations').insert({
    chat_id: chatId,
    action_type: 'task_list_context',
    action_payload: { items: listContext },
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })

  return lines.join('\n')
}

export async function completeTask(
  sb: SupabaseClient,
  chatId: string,
  num: number
): Promise<string> {
  // Busca contexto de numeração
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado na lista. Use /tarefas para atualizar.`

  const { error } = await sb
    .from('tasks')
    .update({ status: 'Concluído', completed_at: new Date().toISOString() })
    .eq('id', item.id)

  if (error) throw error
  return `✅ Tarefa concluída: <b>${item.title}</b>`
}

export async function setPriority(
  sb: SupabaseClient,
  chatId: string,
  num: number,
  priority: string
): Promise<string> {
  const { data: ctx } = await sb
    .from('bot_pending_confirmations')
    .select('action_payload, expires_at')
    .eq('chat_id', chatId)
    .eq('action_type', 'task_list_context')
    .single()

  if (!ctx || new Date(ctx.expires_at) < new Date()) {
    return '❌ Lista expirada. Use /tarefas para ver a lista atualizada.'
  }

  const item = (ctx.action_payload.items as Array<{ num: number; id: string; title: string }>)
    .find((i) => i.num === num)

  if (!item) return `❌ Número ${num} não encontrado. Use /tarefas para atualizar.`

  const { error } = await sb.from('tasks').update({ priority }).eq('id', item.id)
  if (error) throw error
  return `✅ Prioridade de <b>${item.title}</b> alterada para <b>${priority}</b>`
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/actions/tasks.ts
git commit -m "feat(functions): add task actions (create, list, complete, setPriority)"
```

---

## Task 7: Action Layer — Atividades

**Files:**
- Create: `supabase/functions/telegram-webhook/actions/activities.ts`

- [ ] **Step 1: Criar `actions/activities.ts`**

Nota: o campo `body` da tabela `activities` usa formato Tiptap JSON. Para atividades criadas pelo bot, use a estrutura mínima abaixo. O Calendário já lê `scheduled_at` da tabela — reuniões criadas aqui aparecem automaticamente no CalendarView.

```typescript
// supabase/functions/telegram-webhook/actions/activities.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

function makeTiptapBody(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  }
}

const TYPE_LABELS: Record<string, string> = {
  note: '📝 Nota',
  meeting: '🤝 Reunião',
  call: '📞 Ligação',
}

export async function logActivity(
  sb: SupabaseClient,
  type: string,
  text: string
): Promise<string> {
  const title = text || `${TYPE_LABELS[type] ?? type} via Telegram`
  const { error } = await sb.from('activities').insert({
    title,
    type,
    body: makeTiptapBody(text),
    status: 'completed',
    scheduled_at: new Date().toISOString(),
  })
  if (error) throw error
  return `✅ ${TYPE_LABELS[type] ?? type} registrada: <b>${title}</b>`
}

export async function listActivities(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from('activities')
    .select('title, type, scheduled_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma atividade recente.'

  const lines = ['📋 <b>Atividades recentes:</b>']
  for (const a of data) {
    const label = TYPE_LABELS[a.type] ?? a.type
    const date = a.scheduled_at
      ? new Date(a.scheduled_at).toLocaleDateString('pt-BR')
      : '—'
    lines.push(`• ${label}: ${a.title} <i>(${date})</i>`)
  }
  return lines.join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/actions/activities.ts
git commit -m "feat(functions): add activity actions (log, list)"
```

---

## Task 8: Action Layer — Finanças

**Files:**
- Create: `supabase/functions/telegram-webhook/actions/finance.ts`

- [ ] **Step 1: Criar `actions/finance.ts`**

Nota: usa a conta com `category = 'principal'` como padrão (igual ao `getPrincipalAccount()` de `src/lib/financeUtils.js`). Se nenhuma conta principal existir, usa a primeira conta ativa.

```typescript
// supabase/functions/telegram-webhook/actions/finance.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

async function getPrincipalAccountId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from('accounts')
    .select('id, category')
    .eq('is_active', true)

  if (!data || data.length === 0) return null

  // Igual ao getPrincipalAccount() em src/lib/financeUtils.js
  const principal = data.find((a: { id: string; category: string }) => a.category === 'principal')
  return principal?.id ?? data[0].id // fallback: primeira conta ativa
}

export async function recordTransaction(
  sb: SupabaseClient,
  direction: 'in' | 'out',
  description: string,
  amount: number
): Promise<string> {
  const accountId = await getPrincipalAccountId(sb)
  if (!accountId) return '❌ Nenhuma conta encontrada. Crie uma conta no PettoFlow antes de usar este comando.'

  const signedAmount = direction === 'out' ? -Math.abs(amount) : Math.abs(amount)
  const { error } = await sb.from('transactions').insert({
    account_id: accountId,
    amount: signedAmount,
    date: new Date().toISOString().split('T')[0],
    notes: description,
    cleared: false,
    needs_review: true,
  })

  if (error) throw error
  const emoji = direction === 'out' ? '💸' : '💰'
  const label = direction === 'out' ? 'Saída' : 'Entrada'
  return `${emoji} ${label} registrada: <b>${description}</b> — R$ ${amount.toFixed(2).replace('.', ',')}`
}

export async function getBalance(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from('accounts')
    .select('name, opening_balance')
    .eq('is_active', true)

  if (error) throw error
  if (!data || data.length === 0) return '❌ Nenhuma conta encontrada.'

  // Busca saldo real somando transações
  const lines = ['💰 <b>Saldos:</b>']
  for (const account of data) {
    const { data: txs } = await sb
      .from('transactions')
      .select('amount')
      .eq('account_id', account.id)

    const total = (txs ?? []).reduce((sum: number, t: { amount: number }) => sum + (t.amount ?? 0), 0)
    const balance = (account.opening_balance ?? 0) + total
    lines.push(`• ${account.name}: R$ ${balance.toFixed(2).replace('.', ',')}`)
  }
  return lines.join('\n')
}

export async function listTransactions(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from('transactions')
    .select('amount, date, notes')
    .order('date', { ascending: false })
    .limit(5)

  if (error) throw error
  if (!data || data.length === 0) return '📋 Nenhuma transação encontrada.'

  const lines = ['📋 <b>Últimas transações:</b>']
  for (const t of data) {
    const emoji = (t.amount ?? 0) < 0 ? '💸' : '💰'
    const value = Math.abs(t.amount ?? 0).toFixed(2).replace('.', ',')
    const date = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—'
    lines.push(`${emoji} R$ ${value} — ${t.notes ?? '(sem descrição)'} <i>(${date})</i>`)
  }
  return lines.join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/actions/finance.ts
git commit -m "feat(functions): add finance actions (record, balance, list)"
```

---

## Task 9: Fluxo de Confirmação

**Files:**
- Create: `supabase/functions/telegram-webhook/utils/confirm.ts`

- [ ] **Step 1: Criar `utils/confirm.ts`**

```typescript
// supabase/functions/telegram-webhook/utils/confirm.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function requestConfirmation(
  sb: SupabaseClient,
  chatId: string,
  actionType: string,
  actionPayload: Record<string, unknown>,
  confirmMessage: string
): Promise<string> {
  // Limpa confirmação anterior do mesmo chat (se houver)
  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('chat_id', chatId)
    .eq('action_type', actionType)

  await sb.from('bot_pending_confirmations').insert({
    chat_id: chatId,
    action_type: actionType,
    action_payload: actionPayload,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return `⚠️ ${confirmMessage}\n\nResponda <b>SIM</b> para confirmar ou <b>NÃO</b> para cancelar.`
}

export async function getPendingConfirmation(
  sb: SupabaseClient,
  chatId: string
): Promise<{ action_type: string; action_payload: Record<string, unknown> } | null> {
  const { data } = await sb
    .from('bot_pending_confirmations')
    .select('action_type, action_payload, expires_at')
    .eq('chat_id', chatId)
    .not('action_type', 'eq', 'task_list_context')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    await sb.from('bot_pending_confirmations').delete().eq('chat_id', chatId)
    return null
  }
  return data
}

export async function clearPendingConfirmation(
  sb: SupabaseClient,
  chatId: string
): Promise<void> {
  await sb
    .from('bot_pending_confirmations')
    .delete()
    .eq('chat_id', chatId)
    .not('action_type', 'eq', 'task_list_context')
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/utils/confirm.ts
git commit -m "feat(functions): add confirmation flow utility"
```

---

## Task 10: LLM Fallback (NLP Parser)

**Files:**
- Create: `supabase/functions/telegram-webhook/parser/nlp.ts`

- [ ] **Step 1: Criar `parser/nlp.ts`**

```typescript
// supabase/functions/telegram-webhook/parser/nlp.ts
import { isAllowed } from './allowlist.ts'

interface ParsedCommand {
  action: string
  params: Record<string, unknown>
}

const SYSTEM_PROMPT = `Você é um assistente que converte mensagens em português para ações estruturadas do PettoFlow (app de gestão de tarefas, atividades e finanças).

Responda APENAS com JSON no formato: {"action": "...", "params": {...}}
Nunca explique, nunca adicione texto além do JSON.

Ações disponíveis:
- tasks.create: params: {title: string}
- tasks.list: params: {}
- tasks.complete: params: {num: number} (somente se número explícito na mensagem)
- activities.log: params: {type: "note"|"meeting"|"call", text: string}
- finance.record: params: {direction: "in"|"out", description: string, amount: number}
- finance.balance: params: {}
- finance.list: params: {}

Se não entender a intenção, responda: {"action": "unknown", "params": {}}`

export async function parseWithLLM(
  message: string,
  apiKey: string,
  provider: string
): Promise<ParsedCommand | null> {
  try {
    const url = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages'

    let body: string
    let headers: Record<string, string>

    if (provider === 'openai') {
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      body = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        max_tokens: 200,
      })
    } else {
      // Anthropic (padrão)
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      body = JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      })
    }

    const res = await fetch(url, { method: 'POST', headers, body })
    if (!res.ok) return null

    const data = await res.json()
    const text = provider === 'openai'
      ? data.choices?.[0]?.message?.content
      : data.content?.[0]?.text

    if (!text) return null

    const parsed = JSON.parse(text.trim()) as ParsedCommand
    if (!isAllowed(parsed.action)) return null
    return parsed
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/parser/nlp.ts
git commit -m "feat(functions): add LLM fallback parser (Claude Haiku / GPT-4o-mini)"
```

---

## Task 11: Entry Point — telegram-webhook

**Files:**
- Create: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Criar `index.ts`**

```typescript
// supabase/functions/telegram-webhook/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { decrypt } from '../_shared/crypto.ts'
import { validateRequest } from './middleware/auth.ts'
import { parseSlash } from './parser/slash.ts'
import { parseWithLLM } from './parser/nlp.ts'
import { isAllowed } from './parser/allowlist.ts'
import { createTask, listTasks, completeTask, setPriority } from './actions/tasks.ts'
import { logActivity, listActivities } from './actions/activities.ts'
import { recordTransaction, getBalance, listTransactions } from './actions/finance.ts'
import {
  requestConfirmation,
  getPendingConfirmation,
  clearPendingConfirmation,
} from './utils/confirm.ts'

const HELP_TEXT = `🤖 <b>Comandos disponíveis:</b>

<b>Tarefas:</b>
/tarefa [título] — cria tarefa
/tarefas — lista pendentes
/ok [n] — conclui tarefa #n
/prioridade [n] [alta|média|baixa]

<b>Atividades:</b>
/nota [texto] — registra nota
/reuniao [texto] — agenda reunião
/ligacao [para quem] — registra ligação
/atividades — lista recentes

<b>Finanças:</b>
/pagar [desc] [valor] — registra saída
/recebi [desc] [valor] — registra entrada
/saldo — saldo das contas
/extrato — últimas transações

Você também pode escrever em linguagem natural!`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sb = getSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!

  // Carregar config do bot
  const { data: configRow } = await sb
    .from('bot_configs')
    .select('*')
    .limit(1)
    .single()

  if (!configRow) {
    return new Response('Bot not configured', { status: 503 })
  }

  // Descriptografar campos sensíveis
  const webhookSecret = await decrypt(configRow.webhook_secret, encryptionKey)
  const botToken = await decrypt(configRow.telegram_bot_token, encryptionKey)

  const config = {
    webhook_secret: webhookSecret,
    allowed_telegram_ids: configRow.allowed_telegram_ids as string[],
    is_active: configRow.is_active as boolean,
  }

  // Validar segurança (3 camadas)
  const auth = await validateRequest(req, config)

  if (!auth.valid) {
    if (auth.paused) {
      // Notifica que o bot está pausado
      const body = auth.body as { message?: { chat?: { id: number } } }
      const chatId = body?.message?.chat?.id
      if (chatId) {
        await sendMessage(botToken, chatId, '⏸️ Bot pausado. Reative nas Configurações do PettoFlow.')
      }
    }
    return new Response('', { status: auth.status ?? 200 })
  }

  const body = auth.body as {
    message?: {
      chat?: { id: number }
      from?: { id: number }
      text?: string
    }
  }

  const chatId = String(body?.message?.chat?.id ?? '')
  const fromId = String(body?.message?.from?.id ?? '')
  const text = (body?.message?.text ?? '').trim()

  if (!chatId || !text) return new Response('OK', { status: 200 })

  let responseText: string

  try {
    // Verificar se há confirmação pendente e o usuário respondeu SIM/NÃO
    const upperText = text.toUpperCase()
    if (upperText === 'SIM' || upperText === 'NÃO' || upperText === 'NAO') {
      const pending = await getPendingConfirmation(sb, chatId)
      if (pending) {
        await clearPendingConfirmation(sb, chatId)
        if (upperText === 'SIM') {
          const p = pending.action_payload as { direction: 'in' | 'out'; description: string; amount: number }
          responseText = await recordTransaction(sb, p.direction, p.description, p.amount)
        } else {
          responseText = '❌ Transação cancelada.'
        }
        await sendMessage(botToken, chatId, responseText)
        return new Response('OK', { status: 200 })
      }
    }

    // Parse do comando
    let parsed = parseSlash(text)

    if (!parsed && configRow.llm_api_key) {
      // LLM fallback — descriptografa a key
      const llmKey = await decrypt(configRow.llm_api_key, encryptionKey)
      parsed = await parseWithLLM(text, llmKey, configRow.llm_provider ?? 'anthropic')
    }

    if (!parsed || !isAllowed(parsed.action)) {
      responseText = '🤔 Não entendi. Tente /ajuda para ver os comandos disponíveis.'
      await sendMessage(botToken, chatId, responseText)
      return new Response('OK', { status: 200 })
    }

    const { action, params } = parsed

    // Executar action
    switch (action) {
      case 'tasks.create':
        responseText = await createTask(sb, params.title as string)
        break
      case 'tasks.list':
        responseText = await listTasks(sb, chatId)
        break
      case 'tasks.complete':
        responseText = await completeTask(sb, chatId, params.num as number)
        break
      case 'tasks.setPriority':
        responseText = await setPriority(sb, chatId, params.num as number, params.priority as string)
        break
      case 'activities.log':
        responseText = await logActivity(sb, params.type as string, params.text as string)
        break
      case 'activities.list':
        responseText = await listActivities(sb)
        break
      case 'finance.record': {
        const amount = params.amount as number
        const threshold = configRow.confirmation_threshold as number ?? 500
        if (amount > threshold) {
          const dirLabel = params.direction === 'out' ? 'saída' : 'entrada'
          responseText = await requestConfirmation(
            sb,
            chatId,
            'finance.record',
            params as Record<string, unknown>,
            `Confirmar ${dirLabel} de R$ ${amount.toFixed(2).replace('.', ',')} em "${params.description}"?`
          )
        } else {
          responseText = await recordTransaction(
            sb,
            params.direction as 'in' | 'out',
            params.description as string,
            amount
          )
        }
        break
      }
      case 'finance.balance':
        responseText = await getBalance(sb)
        break
      case 'finance.list':
        responseText = await listTransactions(sb)
        break
      case 'bot.start':
        // Registra o fromId na allowlist se não estiver lá
        if (!config.allowed_telegram_ids.includes(fromId)) {
          const newIds = [...config.allowed_telegram_ids, fromId]
          await sb.from('bot_configs').update({ allowed_telegram_ids: newIds }).eq('id', configRow.id)
        }
        responseText = `👋 Olá! Sou o bot do PettoFlow.\nSeu ID Telegram é: <code>${fromId}</code>\n\n${HELP_TEXT}`
        break
      case 'bot.help':
        responseText = HELP_TEXT
        break
      case 'bot.status':
        responseText = '✅ Bot ativo e conectado ao PettoFlow.'
        break
      default:
        responseText = '🤔 Não entendi. Tente /ajuda.'
    }
  } catch (err) {
    console.error('Error processing message:', err)
    responseText = '⚠️ Algo deu errado. Tente novamente em instantes.'
  }

  await sendMessage(botToken, chatId, responseText)
  return new Response('OK', { status: 200 })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat(functions): add telegram-webhook entry point — wires all actions"
```

---

## Task 12: bot-config Edge Function

**Files:**
- Create: `supabase/functions/bot-config/index.ts`

Esta função expõe CRUD de `bot_configs` para o Settings page. Protegida por `X-Bot-Config-Key` header.

- [ ] **Step 1: Criar `supabase/functions/bot-config/index.ts`**

```typescript
// supabase/functions/bot-config/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'
import { encrypt, decrypt } from '../_shared/crypto.ts'
import { registerWebhook, deleteWebhook } from '../_shared/telegram.ts'

function authError() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Config-Key',
      },
    })
  }

  const configKey = req.headers.get('x-bot-config-key')
  if (configKey !== Deno.env.get('BOT_CONFIG_SECRET')) return authError()

  const sb = getSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`

  // GET — retorna config atual (sem campos sensíveis descriptografados)
  if (req.method === 'GET') {
    const { data } = await sb.from('bot_configs').select('*').limit(1).single()
    if (!data) return json(null)
    // Retorna sem o token real
    return json({
      ...data,
      telegram_bot_token: data.telegram_bot_token ? '••••••••••••••••••••••' : null,
      llm_api_key: data.llm_api_key ? '••••••••••••••••' : null,
    })
  }

  // POST — cria/atualiza config e registra webhook
  if (req.method === 'POST') {
    const body = await req.json()
    const { telegram_bot_token, llm_api_key, llm_provider, confirmation_threshold, allowed_telegram_ids } = body

    if (!telegram_bot_token) return json({ error: 'telegram_bot_token is required' }, 400)

    // Gera webhook_secret aleatório
    const webhookSecretRaw = crypto.randomUUID().replace(/-/g, '')

    const encryptedToken = await encrypt(telegram_bot_token, encryptionKey)
    const encryptedSecret = await encrypt(webhookSecretRaw, encryptionKey)
    const encryptedLlmKey = llm_api_key ? await encrypt(llm_api_key, encryptionKey) : null

    // Registra webhook no Telegram
    const webhookResult = await registerWebhook(telegram_bot_token, webhookUrl, webhookSecretRaw)
    if (!webhookResult.ok) {
      return json({ error: `Telegram rejeitou o token: ${webhookResult.description}` }, 400)
    }

    const payload = {
      telegram_bot_token: encryptedToken,
      webhook_secret: encryptedSecret,
      allowed_telegram_ids: allowed_telegram_ids ?? [],
      is_active: true,
      confirmation_threshold: confirmation_threshold ?? 500,
      llm_api_key: encryptedLlmKey,
      llm_provider: llm_provider ?? 'anthropic',
      updated_at: new Date().toISOString(),
    }

    // Upsert (single-row)
    const { data: existing } = await sb.from('bot_configs').select('id').limit(1).single()
    if (existing) {
      await sb.from('bot_configs').update(payload).eq('id', existing.id)
    } else {
      await sb.from('bot_configs').insert(payload)
    }

    return json({ ok: true, message: 'Bot configurado com sucesso!' })
  }

  // PATCH — atualiza campos específicos (pause/resume, threshold, allowlist)
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { data: existing } = await sb.from('bot_configs').select('id').limit(1).single()
    if (!existing) return json({ error: 'Bot não configurado' }, 404)

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.is_active === 'boolean') updatePayload.is_active = body.is_active
    if (typeof body.confirmation_threshold === 'number') updatePayload.confirmation_threshold = body.confirmation_threshold
    if (Array.isArray(body.allowed_telegram_ids)) updatePayload.allowed_telegram_ids = body.allowed_telegram_ids
    if (body.llm_api_key) updatePayload.llm_api_key = await encrypt(body.llm_api_key, encryptionKey)
    if (body.llm_provider) updatePayload.llm_provider = body.llm_provider

    await sb.from('bot_configs').update(updatePayload).eq('id', existing.id)
    return json({ ok: true })
  }

  // DELETE — remove config e cancela webhook
  if (req.method === 'DELETE') {
    const { data: existing } = await sb.from('bot_configs').select('telegram_bot_token').limit(1).single()
    if (existing?.telegram_bot_token) {
      try {
        const token = await decrypt(existing.telegram_bot_token, encryptionKey)
        await deleteWebhook(token)
      } catch { /* ignora erro no delete do webhook */ }
    }
    await sb.from('bot_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    return json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
})
```

- [ ] **Step 2: Configurar variáveis de ambiente no Supabase**

No Supabase Dashboard → Settings → Edge Functions → adicionar:
- `ENCRYPTION_KEY` — gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `BOT_CONFIG_SECRET` — gere com o mesmo comando acima

- [ ] **Step 3: Deploy das funções**

```bash
# Instalar Supabase CLI se necessário
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref qzljsendvthfetrntwab

# Deploy
supabase functions deploy telegram-webhook
supabase functions deploy bot-config
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/bot-config/index.ts
git commit -m "feat(functions): add bot-config Edge Function for Settings CRUD"
```

---

## Task 13: `src/lib/botConfig.js` — Cliente React

**Files:**
- Create: `src/lib/botConfig.js`

- [ ] **Step 1: Criar `src/lib/botConfig.js`**

```javascript
// src/lib/botConfig.js

const BOT_CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-config`
const BOT_CONFIG_KEY = import.meta.env.VITE_BOT_CONFIG_SECRET

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Bot-Config-Key': BOT_CONFIG_KEY,
  }
}

export async function getBotConfig() {
  const res = await fetch(BOT_CONFIG_URL, { headers: headers() })
  if (res.status === 404 || res.status === 204) return null
  if (!res.ok) throw new Error(`Erro ao buscar config: ${res.status}`)
  return res.json()
}

export async function saveBotConfig({ telegramBotToken, llmApiKey, llmProvider, confirmationThreshold }) {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      telegram_bot_token: telegramBotToken,
      llm_api_key: llmApiKey || undefined,
      llm_provider: llmProvider || 'anthropic',
      confirmation_threshold: confirmationThreshold ?? 500,
    }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function updateBotConfig(patch) {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Erro ao atualizar: ${res.status}`)
  return res.json()
}

export async function deleteBotConfig() {
  const res = await fetch(BOT_CONFIG_URL, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ao remover: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Adicionar variável de ambiente ao `.env`**

```bash
# Adicionar ao .env (nunca commitar)
echo "VITE_BOT_CONFIG_SECRET=<mesmo valor de BOT_CONFIG_SECRET do Supabase>" >> .env
```

Verificar que `.env` está no `.gitignore`:
```bash
grep "\.env" .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/botConfig.js
git commit -m "feat(lib): add botConfig client for Settings → Edge Function communication"
```

---

## Task 14: `OnboardingWizard` Component

**Files:**
- Create: `src/components/Settings/OnboardingWizard.jsx`

- [ ] **Step 1: Criar `OnboardingWizard.jsx`**

```jsx
// src/components/Settings/OnboardingWizard.jsx
import { useState } from 'react'
import { saveBotConfig } from '../../lib/botConfig.js'

export default function OnboardingWizard({ onConnected }) {
  const [step, setStep] = useState(1)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleConnect() {
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    try {
      await saveBotConfig({ telegramBotToken: token.trim() })
      onConnected()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '2em', marginBottom: 8 }}>🤖</div>
        <h2 style={{ margin: 0 }}>Conectar Bot Telegram</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Siga os passos — leva menos de 2 minutos
        </p>
      </div>

      {[
        {
          n: 1,
          title: 'Abra o Telegram e busque @BotFather',
          body: (
            <p>
              Envie o comando <code>/newbot</code> e siga as instruções para criar seu bot
              pessoal do PettoFlow.
            </p>
          ),
          done: step > 1,
        },
        {
          n: 2,
          title: 'Copie o token gerado pelo BotFather',
          body: (
            <p>
              Parece com: <code>1234567890:ABCDEFghijklmno...</code>
            </p>
          ),
          done: step > 2,
        },
        {
          n: 3,
          title: 'Cole o token aqui',
          body: (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="1234567890:ABCDEFghijklmnopqrstuvwxyz"
                  style={{ flex: 1 }}
                  disabled={loading}
                />
                <button onClick={handleConnect} disabled={!token.trim() || loading}>
                  {loading ? 'Conectando...' : 'Conectar →'}
                </button>
              </div>
              {error && <p style={{ color: 'var(--color-error, #ef4444)', margin: 0 }}>❌ {error}</p>}
            </div>
          ),
          done: false,
        },
        {
          n: 4,
          title: 'Autorize seu Telegram (automático)',
          body: (
            <p>
              Após conectar, envie <code>/start</code> ao bot. Ele detectará seu ID Telegram
              automaticamente.
            </p>
          ),
          done: false,
          disabled: true,
        },
      ].map(({ n, title, body, done, disabled }) => (
        <div
          key={n}
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 10,
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            opacity: disabled ? 0.5 : 1,
            borderColor: done ? 'var(--color-success, #16a34a)' : 'var(--border-color)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: done ? 'var(--color-success, #16a34a)' : 'var(--bg-secondary)',
              color: done ? 'white' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {done ? '✓' : n}
          </div>
          <div style={{ flex: 1 }}>
            <strong>{title}</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Settings/OnboardingWizard.jsx
git commit -m "feat(settings): add OnboardingWizard component (4-step bot setup)"
```

---

## Task 15: `TelegramSection` Component + Testes

**Files:**
- Create: `src/components/Settings/TelegramSection.jsx`
- Create: `src/components/Settings/__tests__/TelegramSection.test.jsx`

- [ ] **Step 1: Escrever testes primeiro**

```jsx
// src/components/Settings/__tests__/TelegramSection.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TelegramSection from '../TelegramSection.jsx'
import * as botConfig from '../../../lib/botConfig.js'

vi.mock('../../../lib/botConfig.js')

describe('TelegramSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows onboarding wizard when no config exists', async () => {
    botConfig.getBotConfig.mockResolvedValue(null)
    render(<TelegramSection />)
    await waitFor(() => {
      expect(screen.getByText('Conectar Bot Telegram')).toBeTruthy()
    })
  })

  it('shows connected state when config exists', async () => {
    botConfig.getBotConfig.mockResolvedValue({
      is_active: true,
      allowed_telegram_ids: ['123456'],
      confirmation_threshold: 500,
      telegram_bot_token: '••••••••••••••••••••••',
      llm_api_key: null,
    })
    render(<TelegramSection />)
    await waitFor(() => {
      expect(screen.getByText(/Ativo/)).toBeTruthy()
    })
  })

  it('calls updateBotConfig when pause button clicked', async () => {
    botConfig.getBotConfig.mockResolvedValue({
      is_active: true,
      allowed_telegram_ids: [],
      confirmation_threshold: 500,
      telegram_bot_token: '••••',
      llm_api_key: null,
    })
    botConfig.updateBotConfig.mockResolvedValue({ ok: true })
    render(<TelegramSection />)
    await waitFor(() => screen.getByText('Pausar'))
    fireEvent.click(screen.getByText('Pausar'))
    await waitFor(() => {
      expect(botConfig.updateBotConfig).toHaveBeenCalledWith({ is_active: false })
    })
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
npm test src/components/Settings/__tests__/TelegramSection.test.jsx
```

Esperado: erro "Cannot find module '../TelegramSection.jsx'"

- [ ] **Step 3: Criar `TelegramSection.jsx`**

```jsx
// src/components/Settings/TelegramSection.jsx
import { useState, useEffect, useCallback } from 'react'
import { getBotConfig, updateBotConfig, deleteBotConfig } from '../../lib/botConfig.js'
import OnboardingWizard from './OnboardingWizard.jsx'

export default function TelegramSection() {
  const [config, setConfig] = useState(undefined) // undefined = loading
  const [saving, setSaving] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [newId, setNewId] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [llmKey, setLlmKey] = useState('')

  const loadConfig = useCallback(async () => {
    try {
      const data = await getBotConfig()
      setConfig(data)
      if (data) setThreshold(String(data.confirmation_threshold ?? 500))
    } catch {
      setConfig(null)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function toggleActive() {
    if (!config) return
    setSaving(true)
    try {
      await updateBotConfig({ is_active: !config.is_active })
      setConfig((prev) => ({ ...prev, is_active: !prev.is_active }))
    } finally {
      setSaving(false)
    }
  }

  async function saveThreshold() {
    const val = parseFloat(threshold.replace(',', '.'))
    if (isNaN(val)) return
    setSaving(true)
    try {
      await updateBotConfig({ confirmation_threshold: val })
    } finally {
      setSaving(false)
    }
  }

  async function addTelegramId() {
    const trimmed = newId.trim()
    if (!trimmed || !config) return
    const updated = [...(config.allowed_telegram_ids ?? []), trimmed]
    setSaving(true)
    try {
      await updateBotConfig({ allowed_telegram_ids: updated })
      setConfig((prev) => ({ ...prev, allowed_telegram_ids: updated }))
      setNewId('')
    } finally {
      setSaving(false)
    }
  }

  async function removeId(id) {
    const updated = config.allowed_telegram_ids.filter((i) => i !== id)
    setSaving(true)
    try {
      await updateBotConfig({ allowed_telegram_ids: updated })
      setConfig((prev) => ({ ...prev, allowed_telegram_ids: updated }))
    } finally {
      setSaving(false)
    }
  }

  async function saveLlmKey() {
    if (!llmKey.trim()) return
    setSaving(true)
    try {
      await updateBotConfig({ llm_api_key: llmKey.trim() })
      setLlmKey('')
      setShowLlmKey(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Remover a configuração do bot? O webhook será cancelado.')) return
    await deleteBotConfig()
    setConfig(null)
  }

  if (config === undefined) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>

  if (!config) {
    return <OnboardingWizard onConnected={loadConfig} />
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: config.is_active ? 'var(--bg-success-subtle, #0f2a1a)' : 'var(--bg-secondary)',
          border: `1px solid ${config.is_active ? '#16a34a' : 'var(--border-color)'}`,
          borderRadius: 10,
        }}
      >
        <div>
          <strong style={{ color: config.is_active ? '#4ade80' : 'var(--text-secondary)' }}>
            {config.is_active ? '● Bot Ativo' : '● Bot Pausado'}
          </strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            Telegram conectado ao PettoFlow
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleActive} disabled={saving}>
            {config.is_active ? 'Pausar' : 'Reativar'}
          </button>
          <button onClick={handleDisconnect} disabled={saving} style={{ color: 'var(--color-error, #ef4444)' }}>
            Desconectar
          </button>
        </div>
      </div>

      {/* Token */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>🔑 Token do Bot</strong>
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
          {config.telegram_bot_token}
        </div>
      </div>

      {/* Allowlist */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>👤 IDs Telegram Autorizados</strong>
        <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
          Envie /start ao bot para obter seu ID automaticamente
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(config.allowed_telegram_ids ?? []).map((id) => (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 20, fontFamily: 'monospace', fontSize: '0.85em' }}>
              {id}
              <button onClick={() => removeId(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ID numérico" style={{ width: 120 }} onKeyDown={(e) => e.key === 'Enter' && addTelegramId()} />
            <button onClick={addTelegramId} disabled={!newId.trim()}>+ Adicionar</button>
          </div>
        </div>
      </div>

      {/* Threshold */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>💸 Confirmação acima de</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>R$</span>
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ width: 100, textAlign: 'right' }} />
          <button onClick={saveThreshold} disabled={saving}>Salvar</button>
          <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>— bot pedirá confirmação</span>
        </div>
      </div>

      {/* LLM Key */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '0.9em' }}>🤖 API Key LLM (linguagem natural)</strong>
            <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {config.llm_api_key ? '✅ Configurada' : 'Opcional — sem isso só slash commands funcionam'}
            </p>
          </div>
          <button onClick={() => setShowLlmKey((v) => !v)}>{showLlmKey ? 'Fechar ▲' : 'Configurar ▾'}</button>
        </div>
        {showLlmKey && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <input type="password" value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder="sk-ant-... ou sk-..." style={{ flex: 1 }} />
            <button onClick={saveLlmKey} disabled={!llmKey.trim() || saving}>Salvar</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/components/Settings/__tests__/TelegramSection.test.jsx
```

Esperado: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/
git commit -m "feat(settings): add TelegramSection component with tests"
```

---

## Task 16: `SettingsView` + Sidebar + Roteamento

**Files:**
- Create: `src/components/Settings/SettingsView.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Criar `SettingsView.jsx`**

```jsx
// src/components/Settings/SettingsView.jsx
import { useState } from 'react'
import TelegramSection from './TelegramSection.jsx'

const TABS = [{ id: 'telegram', label: '🤖 Telegram' }]

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('telegram')

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 4px' }}>Configurações</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Gerencie integrações e preferências do PettoFlow
      </p>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'telegram' && <TelegramSection />}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar item no Sidebar**

Abra `src/components/Sidebar.jsx`. Adicione o import do ícone no topo junto aos outros imports do lucide-react:

```jsx
import { Settings } from 'lucide-react'
```

Localize o array `menuItems` (linha ~7) e adicione ao final:

```jsx
const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tarefas', label: 'Minhas Tarefas', icon: CheckSquare },
  { id: 'atividades', label: 'Atividades', icon: Activity },
  { id: 'financas',   label: 'Finanças',   icon: Wallet   },
  { id: 'time',       label: 'Time',        icon: Users    },
  { id: 'clientes', label: 'Clientes', icon: UserCircle },
  { id: 'arquivo',  label: 'Arquivo',  icon: Archive   },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'settings', label: 'Configurações', icon: Settings }, // ← novo
];
```

- [ ] **Step 3: Adicionar rota no App.jsx**

Abra `src/App.jsx`. Adicione o import no topo junto aos outros imports de views:

```jsx
import SettingsView from './components/Settings/SettingsView'
```

Localize a função `renderContent()` (linha ~284) e adicione o case antes do `default`:

```jsx
case 'settings':
  return <SettingsView />
```

Localize também a função `getPageTitle()` (linha ~270) e adicione:

```jsx
case 'settings': return 'Configurações'
```

- [ ] **Step 4: Testar manualmente**

```bash
npm run dev
```

1. Verificar que "Configurações" aparece no sidebar
2. Clicar e ver a SettingsView com a tab Telegram
3. Sem bot configurado: deve mostrar o OnboardingWizard

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/SettingsView.jsx src/components/Sidebar.jsx src/App.jsx
git commit -m "feat(settings): add SettingsView, wire to Sidebar and App routing"
```

---

## Task 17: Teste de Integração — Fluxo Completo

- [ ] **Step 1: Testar o fluxo completo com bot real**

1. Abrir PettoFlow → Configurações → Telegram
2. Criar bot via @BotFather → obter token
3. Colar token no OnboardingWizard → clicar "Conectar"
4. Deve aparecer estado "Bot Ativo"
5. Enviar `/start` ao bot no Telegram → confirmar que ID foi adicionado à allowlist
6. Enviar `/tarefa teste de integração` → confirmar que tarefa aparece no PettoFlow
7. Enviar `/tarefas` → confirmar lista retornada
8. Enviar `/nota testando o bot` → confirmar activity criada
9. Enviar `/pagar almoço 25` → confirmar transação criada
10. Enviar `/pagar fornecedor 600` → confirmar que pediu confirmação (> R$500)
11. Responder `SIM` → confirmar que transação foi criada
12. Enviar `/saldo` → confirmar retorno dos saldos
13. Enviar texto livre (se LLM configurado): "adiciona tarefa ligar pro veterinário" → confirmar criação

- [ ] **Step 2: Commit final**

```bash
git add .
git commit -m "feat: complete Telegram bot integration — slash commands + LLM fallback via Supabase Edge Functions"
```

---

## Variáveis de Ambiente — Checklist Final

| Variável | Onde configurar | Valor |
|---|---|---|
| `ENCRYPTION_KEY` | Supabase → Edge Functions secrets | 32 bytes hex aleatório |
| `BOT_CONFIG_SECRET` | Supabase → Edge Functions secrets | UUID ou string aleatória |
| `VITE_BOT_CONFIG_SECRET` | `.env` local | Mesmo valor de `BOT_CONFIG_SECRET` |
| `VITE_SUPABASE_URL` | `.env` (já existe) | `https://qzljsendvthfetrntwab.supabase.co` |

Gerar valores: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
