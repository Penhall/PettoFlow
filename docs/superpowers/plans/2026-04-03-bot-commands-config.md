# Bot Commands Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar tabela `bot_commands`, Edge Function de CRUD, UI de gerenciamento em Settings, e integração no webhook para executar comandos customizados antes do parseSlash.

**Architecture:** Nova tabela `bot_commands` no Supabase armazena built-ins (referência toggleável) e comandos custom (shortcut/template/multi). Edge Function `bot-commands` expõe CRUD autenticado via `X-Bot-Config-Key`. O webhook carrega os comandos ativos a cada request e resolve custom commands antes de cair em `parseSlash`/NLP.

**Tech Stack:** Deno/TypeScript (Edge Functions), React/JSX (frontend), Supabase (Postgres + RLS), Vitest + Testing Library (testes frontend).

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260403000000_bot_commands.sql` | Criar | DDL da tabela + RLS |
| `supabase/functions/bot-commands/index.ts` | Criar | Edge Function CRUD + seed |
| `src/lib/botCommands.js` | Criar | Client frontend para bot-commands |
| `supabase/functions/telegram-webhook/utils/actions.ts` | Criar | `executeActions()` compartilhado |
| `supabase/functions/telegram-webhook/index.ts` | Modificar | Resolver custom commands antes de parseSlash |
| `src/components/Settings/CommandsSection.jsx` | Criar | Tela principal — lista + toggle |
| `src/components/Settings/CommandForm.jsx` | Criar | Formulário criar/editar comando |
| `src/components/Settings/SettingsView.jsx` | Modificar | Adicionar aba Comandos |
| `src/components/Settings/OnboardingWizard.jsx` | Modificar | Chamar seed após conectar |
| `src/components/Settings/__tests__/CommandsSection.test.jsx` | Criar | Testes do componente principal |

---

## Task 1: SQL Migration — Tabela `bot_commands`

**Files:**
- Create: `supabase/migrations/20260403000000_bot_commands.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260403000000_bot_commands.sql

create table if not exists bot_commands (
  id            uuid primary key default gen_random_uuid(),
  bot_config_id uuid references bot_configs(id) on delete cascade not null,
  trigger       text not null,
  description   text not null,
  type          text not null check (type in ('builtin', 'shortcut', 'template', 'multi')),
  actions       jsonb not null default '[]'::jsonb,
  examples      text[] default '{}',
  category      text not null check (category in ('tasks', 'activities', 'finance', 'custom')),
  is_active     boolean default true not null,
  is_default    boolean default true not null,
  created_at    timestamptz default now() not null
);

alter table bot_commands enable row level security;

-- Acesso total via service role key (usado pelas Edge Functions)
create policy "service role full access"
  on bot_commands
  using (true)
  with check (true);
```

- [ ] **Step 2: Aplicar migration via Supabase MCP**

Use a ferramenta `mcp__plugin_supabase_supabase__apply_migration` com `project_id: qzljsendvthfetrntwab` e o SQL acima.

- [ ] **Step 3: Verificar tabela criada**

Use `mcp__plugin_supabase_supabase__execute_sql` com:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'bot_commands' order by ordinal_position;
```
Expected: 10 colunas listadas (id, bot_config_id, trigger, description, type, actions, examples, category, is_active, is_default, created_at).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260403000000_bot_commands.sql
git commit -m "feat(db): add bot_commands table with RLS"
```

---

## Task 2: Edge Function `bot-commands`

**Files:**
- Create: `supabase/functions/bot-commands/index.ts`

- [ ] **Step 1: Criar Edge Function**

```typescript
// supabase/functions/bot-commands/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'

const DEFAULT_COMMANDS = [
  // Built-ins — tasks
  { trigger: '/tarefa', description: 'Cria uma nova tarefa', type: 'builtin', actions: [], examples: ['Cria uma tarefa de...', 'Adiciona tarefa...'], category: 'tasks' },
  { trigger: '/tarefas', description: 'Lista tarefas pendentes', type: 'builtin', actions: [], examples: ['Quais minhas tarefas?', 'Ver tarefas'], category: 'tasks' },
  { trigger: '/ok', description: 'Conclui uma tarefa pelo número', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  { trigger: '/prioridade', description: 'Define prioridade de tarefa', type: 'builtin', actions: [], examples: [], category: 'tasks' },
  // Built-ins — activities
  { trigger: '/nota', description: 'Registra uma nota', type: 'builtin', actions: [], examples: ['Anota que...', 'Registra nota...'], category: 'activities' },
  { trigger: '/reuniao', description: 'Registra uma reunião', type: 'builtin', actions: [], examples: ['Agende uma reunião para...', 'Tive reunião com...'], category: 'activities' },
  { trigger: '/ligacao', description: 'Registra uma ligação', type: 'builtin', actions: [], examples: ['Liguei para...', 'Registra ligação com...'], category: 'activities' },
  { trigger: '/atividades', description: 'Lista atividades recentes', type: 'builtin', actions: [], examples: ['Minhas atividades', 'O que fiz hoje?'], category: 'activities' },
  // Built-ins — finance
  { trigger: '/pagar', description: 'Registra uma saída financeira', type: 'builtin', actions: [], examples: ['Paguei R$X de...', 'Gastei R$X com...'], category: 'finance' },
  { trigger: '/recebi', description: 'Registra uma entrada financeira', type: 'builtin', actions: [], examples: ['Recebi R$X de...', 'Entrada de R$X'], category: 'finance' },
  { trigger: '/saldo', description: 'Consulta saldo das contas', type: 'builtin', actions: [], examples: ['Qual o saldo?', 'Ver saldo'], category: 'finance' },
  { trigger: '/extrato', description: 'Lista últimas transações', type: 'builtin', actions: [], examples: ['Últimas transações', 'Ver extrato'], category: 'finance' },
  // Custom pré-configurados
  { trigger: '/cafe', description: 'Saída rápida: café R$8', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'café', amount: 8.00 } }], examples: [], category: 'custom' },
  { trigger: '/almoco', description: 'Saída rápida: almoço R$35', type: 'shortcut', actions: [{ action: 'finance.record', params: { direction: 'out', description: 'almoço', amount: 35.00 } }], examples: [], category: 'custom' },
  { trigger: '/reuniao-semanal', description: 'Registra reunião semanal de equipe', type: 'template', actions: [{ action: 'activities.log', params: { type: 'meeting', text: 'Reunião semanal de equipe' } }], examples: [], category: 'custom' },
  { trigger: '/inicio-do-dia', description: 'Saldo + lista de tarefas pendentes', type: 'multi', actions: [{ action: 'finance.balance', params: {} }, { action: 'tasks.list', params: {} }], examples: [], category: 'custom' },
  { trigger: '/fim-de-dia', description: 'Tarefas pendentes + extrato do dia', type: 'multi', actions: [{ action: 'tasks.list', params: {} }, { action: 'finance.list', params: {} }], examples: [], category: 'custom' },
]

function authError() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function corsHeaders() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Config-Key',
    },
  })
}

async function getBotConfigId(sb: ReturnType<typeof getSupabaseClient>): Promise<string | null> {
  const { data } = await sb.from('bot_configs').select('id').limit(1).single()
  return data?.id ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsHeaders()

  const configKey = req.headers.get('x-bot-config-key')
  if (configKey !== Deno.env.get('BOT_CONFIG_SECRET')) return authError()

  const sb = getSupabaseClient()
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastSegment = pathParts[pathParts.length - 1]
  // lastSegment é 'bot-commands' para root, 'seed' para /seed, ou um UUID para /:id
  const commandId = (lastSegment !== 'bot-commands' && lastSegment !== 'seed') ? lastSegment : null
  const isSeed = lastSegment === 'seed'

  // GET — lista todos os comandos
  if (req.method === 'GET') {
    const botConfigId = await getBotConfigId(sb)
    if (!botConfigId) return json([])
    const { data, error } = await sb
      .from('bot_commands')
      .select('*')
      .eq('bot_config_id', botConfigId)
      .order('category')
      .order('type')
      .order('trigger')
    if (error) return json({ error: error.message }, 500)
    return json(data ?? [])
  }

  // POST /seed — insere os comandos padrão
  if (req.method === 'POST' && isSeed) {
    const botConfigId = await getBotConfigId(sb)
    if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

    const { count } = await sb
      .from('bot_commands')
      .select('id', { count: 'exact', head: true })
      .eq('bot_config_id', botConfigId)

    if ((count ?? 0) > 0) return json({ ok: true, skipped: true })

    const rows = DEFAULT_COMMANDS.map((cmd) => ({ ...cmd, bot_config_id: botConfigId, is_default: true }))
    const { error } = await sb.from('bot_commands').insert(rows)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, seeded: rows.length })
  }

  // POST — cria um novo comando customizado
  if (req.method === 'POST') {
    const botConfigId = await getBotConfigId(sb)
    if (!botConfigId) return json({ error: 'Bot não configurado' }, 404)

    const body = await req.json()
    const { trigger, description, type, actions, examples, category } = body

    if (!trigger || !description || !type || !category) {
      return json({ error: 'trigger, description, type e category são obrigatórios' }, 400)
    }
    if (!['shortcut', 'template', 'multi'].includes(type)) {
      return json({ error: 'type deve ser shortcut, template ou multi' }, 400)
    }

    const { data, error } = await sb.from('bot_commands').insert({
      bot_config_id: botConfigId,
      trigger,
      description,
      type,
      actions: actions ?? [],
      examples: examples ?? [],
      category,
      is_default: false,
    }).select().single()

    if (error) return json({ error: error.message }, 500)
    return json(data, 201)
  }

  // PATCH /:id — atualiza um comando (toggle ou edição completa)
  if (req.method === 'PATCH' && commandId) {
    const body = await req.json()
    const allowedFields = ['is_active', 'description', 'actions', 'examples', 'trigger']
    const patch: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) patch[field] = body[field]
    }
    const { data, error } = await sb
      .from('bot_commands')
      .update(patch)
      .eq('id', commandId)
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // DELETE /:id — remove um comando (somente is_default = false)
  if (req.method === 'DELETE' && commandId) {
    const { data: existing } = await sb
      .from('bot_commands')
      .select('is_default')
      .eq('id', commandId)
      .single()

    if (!existing) return json({ error: 'Comando não encontrado' }, 404)
    if (existing.is_default) return json({ error: 'Comandos padrão não podem ser deletados' }, 403)

    const { error } = await sb.from('bot_commands').delete().eq('id', commandId)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/bot-commands/index.ts
git commit -m "feat(functions): add bot-commands Edge Function — CRUD + seed"
```

---

## Task 3: Frontend Client `botCommands.js`

**Files:**
- Create: `src/lib/botCommands.js`

- [ ] **Step 1: Criar client**

```js
// src/lib/botCommands.js

const BOT_COMMANDS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-commands`
const BOT_CONFIG_KEY = import.meta.env.VITE_BOT_CONFIG_SECRET

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Bot-Config-Key': BOT_CONFIG_KEY,
  }
}

export async function listCommands() {
  const res = await fetch(BOT_COMMANDS_URL, { headers: headers() })
  if (!res.ok) throw new Error(`Erro ao listar comandos: ${res.status}`)
  return res.json()
}

export async function createCommand(command) {
  const res = await fetch(BOT_COMMANDS_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(command),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function updateCommand(id, patch) {
  const res = await fetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Erro ao atualizar comando: ${res.status}`)
  return res.json()
}

export async function toggleCommand(id, isActive) {
  return updateCommand(id, { is_active: isActive })
}

export async function deleteCommand(id) {
  const res = await fetch(`${BOT_COMMANDS_URL}/${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? `Erro ${res.status}`)
  }
  return res.json()
}

export async function seedDefaultCommands() {
  const res = await fetch(`${BOT_COMMANDS_URL}/seed`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ao seedar comandos: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/botCommands.js
git commit -m "feat(lib): add botCommands client for CRUD + seed"
```

---

## Task 4: `executeActions()` — Webhook Utility

**Files:**
- Create: `supabase/functions/telegram-webhook/utils/actions.ts`

- [ ] **Step 1: Criar utilitário**

```typescript
// supabase/functions/telegram-webhook/utils/actions.ts
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { createTask, listTasks } from '../actions/tasks.ts'
import { logActivity, listActivities } from '../actions/activities.ts'
import { recordTransaction, getBalance, listTransactions } from '../actions/finance.ts'

export interface ActionItem {
  action: string
  params: Record<string, unknown>
}

export async function executeActions(
  sb: SupabaseClient,
  chatId: string,
  actions: ActionItem[]
): Promise<string> {
  const results: string[] = []

  for (const { action, params } of actions) {
    switch (action) {
      case 'finance.record':
        results.push(await recordTransaction(
          sb,
          params.direction as 'in' | 'out',
          params.description as string,
          params.amount as number
        ))
        break
      case 'finance.balance':
        results.push(await getBalance(sb))
        break
      case 'finance.list':
        results.push(await listTransactions(sb))
        break
      case 'tasks.create':
        results.push(await createTask(sb, params.title as string))
        break
      case 'tasks.list':
        results.push(await listTasks(sb, chatId))
        break
      case 'activities.log':
        results.push(await logActivity(
          sb,
          params.type as string,
          params.text as string
        ))
        break
      case 'activities.list':
        results.push(await listActivities(sb))
        break
      default:
        console.warn('[actions] unknown action:', action)
    }
  }

  return results.filter(Boolean).join('\n\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/utils/actions.ts
git commit -m "feat(functions): add executeActions utility for bot_commands"
```

---

## Task 5: Integração no Webhook

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Adicionar import de `executeActions` no topo do arquivo**

Após a linha `import { transcribeVoice } from './utils/voice.ts'`, adicionar:

```typescript
import { executeActions } from './utils/actions.ts'
```

- [ ] **Step 2: Carregar `bot_commands` após validar auth**

Após a linha `const body = auth.body as { ... }` (após o bloco do `auth.valid`), e antes da linha `const chatId = String(...)`, inserir:

```typescript
  // Carregar comandos ativos do banco
  const { data: botCommands } = await sb
    .from('bot_commands')
    .select('trigger, type, actions, is_active')
    .eq('bot_config_id', configRow.id)

  const activeCommands = (botCommands ?? []).filter((c: { is_active: boolean }) => c.is_active)
  const disabledBuiltins = (botCommands ?? []).filter(
    (c: { type: string; is_active: boolean }) => c.type === 'builtin' && !c.is_active
  )
```

- [ ] **Step 3: Resolver custom commands antes de `parseSlash`**

Após o bloco de voz (após `if (!chatId || !text) return new Response('OK', { status: 200 })`), e antes do bloco `let responseText: string`, inserir:

```typescript
  // Bloquear built-ins desativados
  for (const cmd of disabledBuiltins) {
    if (text === cmd.trigger || text.startsWith(cmd.trigger + ' ')) {
      return new Response('OK', { status: 200 })
    }
  }

  // Executar comandos customizados (shortcut / template / multi)
  const matchedCustom = activeCommands.find(
    (c: { type: string; trigger: string }) =>
      c.type !== 'builtin' && (text === c.trigger || text.startsWith(c.trigger + ' '))
  )
  if (matchedCustom) {
    try {
      const result = await executeActions(sb, chatId, matchedCustom.actions)
      await sendMessage(botToken, chatId, result || '\u2705 Conclu\u00eddo.')
    } catch (err) {
      console.error('[custom-cmd] error:', err)
      await sendMessage(botToken, chatId, '\u26a0\ufe0f Erro ao executar comando. Tente novamente.')
    }
    return new Response('OK', { status: 200 })
  }
```

- [ ] **Step 4: Deploy do webhook via Supabase MCP**

Use `mcp__plugin_supabase_supabase__deploy_edge_function` com todos os arquivos da função (incluindo o novo `utils/actions.ts` e o `index.ts` modificado).

- [ ] **Step 5: Testar via Telegram**

Envie `/cafe` no Telegram. Esperado: resposta `💸 Saída registrada: café — R$ 8,00`.
Envie `/inicio-do-dia`. Esperado: saldo + lista de tarefas concatenados.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts supabase/functions/telegram-webhook/utils/actions.ts
git commit -m "feat(functions): resolve custom bot_commands before parseSlash in webhook"
```

---

## Task 6: `CommandsSection.jsx` — Tela Principal

**Files:**
- Create: `src/components/Settings/CommandsSection.jsx`

- [ ] **Step 1: Criar componente**

```jsx
// src/components/Settings/CommandsSection.jsx
import { useState, useEffect, useCallback } from 'react'
import { listCommands, toggleCommand, deleteCommand } from '../../lib/botCommands.js'
import CommandForm from './CommandForm.jsx'

const CATEGORY_LABELS = {
  tasks: '📋 Tarefas',
  activities: '📝 Atividades',
  finance: '💰 Finanças',
  custom: '⚡ Personalizados',
}

const TYPE_LABELS = {
  builtin: 'Built-in',
  shortcut: 'Atalho',
  template: 'Template',
  multi: 'Multi',
}

export default function CommandsSection() {
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('builtin')
  const [showForm, setShowForm] = useState(false)
  const [editingCommand, setEditingCommand] = useState(null)
  const [saving, setSaving] = useState(null) // id do comando sendo salvo

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listCommands()
      setCommands(data)
    } catch (err) {
      console.error('Erro ao carregar comandos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(cmd) {
    setSaving(cmd.id)
    try {
      await toggleCommand(cmd.id, !cmd.is_active)
      setCommands((prev) =>
        prev.map((c) => c.id === cmd.id ? { ...c, is_active: !c.is_active } : c)
      )
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(cmd) {
    if (!confirm(`Remover o comando ${cmd.trigger}?`)) return
    setSaving(cmd.id)
    try {
      await deleteCommand(cmd.id)
      setCommands((prev) => prev.filter((c) => c.id !== cmd.id))
    } finally {
      setSaving(null)
    }
  }

  function handleFormSave(newCmd) {
    if (editingCommand) {
      setCommands((prev) => prev.map((c) => c.id === newCmd.id ? newCmd : c))
    } else {
      setCommands((prev) => [...prev, newCmd])
    }
    setShowForm(false)
    setEditingCommand(null)
  }

  const builtins = commands.filter((c) => c.type === 'builtin')
  const customs = commands.filter((c) => c.type !== 'builtin')

  const grouped = builtins.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando comandos...</p>

  if (showForm) {
    return (
      <CommandForm
        command={editingCommand}
        onSave={handleFormSave}
        onCancel={() => { setShowForm(false); setEditingCommand(null) }}
      />
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>⚡ Comandos do Bot</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            Gerencie e crie comandos personalizados
          </p>
        </div>
        <button onClick={() => { setEditingCommand(null); setShowForm(true) }}>+ Novo</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'builtin', label: '🔧 Built-in' },
          { id: 'custom', label: '✨ Personalizados' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Built-in tab */}
      {activeTab === 'builtin' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {['tasks', 'activities', 'finance'].map((cat) => (
            <div key={cat}>
              <p style={{ margin: '0 0 6px', fontSize: '0.8em', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {CATEGORY_LABELS[cat]}
              </p>
              <div style={{ display: 'grid', gap: 4 }}>
                {(grouped[cat] ?? []).map((cmd) => (
                  <CommandRow
                    key={cmd.id}
                    cmd={cmd}
                    saving={saving === cmd.id}
                    onToggle={() => handleToggle(cmd)}
                    showEdit={false}
                    showDelete={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom tab */}
      {activeTab === 'custom' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {customs.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
              Nenhum comando personalizado ainda.<br />Clique em "+ Novo" para criar.
            </p>
          )}
          {customs.map((cmd) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              saving={saving === cmd.id}
              onToggle={() => handleToggle(cmd)}
              onEdit={() => { setEditingCommand(cmd); setShowForm(true) }}
              onDelete={() => handleDelete(cmd)}
              showEdit
              showDelete={!cmd.is_default}
            />
          ))}
          <button
            onClick={() => { setEditingCommand(null); setShowForm(true) }}
            style={{ marginTop: 8, alignSelf: 'start' }}
          >
            + Adicionar comando
          </button>
        </div>
      )}
    </div>
  )
}

function CommandRow({ cmd, saving, onToggle, onEdit, onDelete, showEdit, showDelete }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        opacity: cmd.is_active ? 1 : 0.5,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: '0.9em', fontWeight: 600 }}>{cmd.trigger}</code>
          <span style={{
            fontSize: '0.7em', padding: '1px 6px',
            background: 'var(--bg-secondary)', borderRadius: 10,
            color: 'var(--text-secondary)',
          }}>
            {TYPE_LABELS[cmd.type] ?? cmd.type}
          </span>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: '0.82em', color: 'var(--text-secondary)' }}>
          {cmd.description}
        </p>
        {cmd.examples?.length > 0 && (
          <p style={{ margin: '2px 0 0', fontSize: '0.78em', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            💬 {cmd.examples.slice(0, 2).join(' · ')}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {showEdit && (
          <button onClick={onEdit} style={{ padding: '4px 8px', fontSize: '0.85em' }}>✏️</button>
        )}
        {showDelete && (
          <button onClick={onDelete} disabled={saving} style={{ padding: '4px 8px', fontSize: '0.85em', color: 'var(--color-error, #ef4444)' }}>
            🗑
          </button>
        )}
        <button onClick={onToggle} disabled={saving} style={{ padding: '4px 8px', fontSize: '0.85em' }}>
          {cmd.is_active ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Settings/CommandsSection.jsx
git commit -m "feat(settings): add CommandsSection component"
```

---

## Task 7: `CommandForm.jsx` — Formulário Criar/Editar

**Files:**
- Create: `src/components/Settings/CommandForm.jsx`

- [ ] **Step 1: Criar componente**

```jsx
// src/components/Settings/CommandForm.jsx
import { useState } from 'react'
import { createCommand, updateCommand } from '../../lib/botCommands.js'

const ACTION_OPTIONS = [
  { value: 'finance.balance', label: 'Ver saldo' },
  { value: 'finance.list', label: 'Ver extrato' },
  { value: 'tasks.list', label: 'Listar tarefas' },
  { value: 'activities.list', label: 'Listar atividades' },
]

const MULTI_ACTIONS = [
  { value: '', label: '— selecione —' },
  { value: 'finance.balance', label: 'Ver saldo' },
  { value: 'finance.list', label: 'Ver extrato' },
  { value: 'tasks.list', label: 'Listar tarefas' },
  { value: 'activities.list', label: 'Listar atividades' },
]

function buildActions(type, shortcutData, templateData, multiData) {
  if (type === 'shortcut') {
    return [{
      action: 'finance.record',
      params: {
        direction: shortcutData.direction,
        description: shortcutData.description,
        amount: parseFloat(shortcutData.amount) || 0,
      },
    }]
  }
  if (type === 'template') {
    return [{
      action: 'activities.log',
      params: { type: templateData.activityType, text: templateData.text },
    }]
  }
  if (type === 'multi') {
    return multiData.filter((a) => a !== '').map((action) => ({ action, params: {} }))
  }
  return []
}

export default function CommandForm({ command, onSave, onCancel }) {
  const isEdit = !!command

  const [trigger, setTrigger] = useState(command?.trigger ?? '/')
  const [description, setDescription] = useState(command?.description ?? '')
  const [type, setType] = useState(command?.type ?? 'shortcut')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Shortcut fields
  const [shortcutDirection, setShortcutDirection] = useState(
    command?.actions?.[0]?.params?.direction ?? 'out'
  )
  const [shortcutDescription, setShortcutDescription] = useState(
    command?.actions?.[0]?.params?.description ?? ''
  )
  const [shortcutAmount, setShortcutAmount] = useState(
    String(command?.actions?.[0]?.params?.amount ?? '')
  )

  // Template fields
  const [templateActivityType, setTemplateActivityType] = useState(
    command?.actions?.[0]?.params?.type ?? 'meeting'
  )
  const [templateText, setTemplateText] = useState(
    command?.actions?.[0]?.params?.text ?? ''
  )

  // Multi fields
  const [multiActions, setMultiActions] = useState(
    command?.type === 'multi'
      ? command.actions.map((a) => a.action)
      : ['', '']
  )

  async function handleSubmit() {
    if (!trigger.startsWith('/') || trigger.length < 2) {
      setError('Trigger deve começar com / e ter pelo menos 2 caracteres')
      return
    }
    if (!description.trim()) {
      setError('Descrição é obrigatória')
      return
    }

    const actions = buildActions(
      type,
      { direction: shortcutDirection, description: shortcutDescription, amount: shortcutAmount },
      { activityType: templateActivityType, text: templateText },
      multiActions
    )

    const payload = {
      trigger: trigger.trim(),
      description: description.trim(),
      type,
      actions,
      examples: [],
      category: 'custom',
    }

    setSaving(true)
    setError(null)
    try {
      let result
      if (isEdit) {
        result = await updateCommand(command.id, payload)
      } else {
        result = await createCommand(payload)
      }
      onSave(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <h3 style={{ margin: '0 0 16px' }}>{isEdit ? 'Editar Comando' : 'Novo Comando'}</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* Trigger */}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Trigger</span>
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="/meu-comando"
            disabled={isEdit}
          />
          <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
            Deve começar com /. Ex: /cafe, /fim-de-dia
          </span>
        </label>

        {/* Descrição */}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que este comando faz"
          />
        </label>

        {/* Tipo */}
        {!isEdit && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="shortcut">Atalho — registra uma transação com valores fixos</option>
              <option value="template">Template — registra atividade com texto pré-definido</option>
              <option value="multi">Multi-ação — executa várias ações em sequência</option>
            </select>
          </label>
        )}

        {/* Shortcut fields */}
        {type === 'shortcut' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Configuração do Atalho</p>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Tipo</span>
              <select value={shortcutDirection} onChange={(e) => setShortcutDirection(e.target.value)}>
                <option value="out">Saída (gasto)</option>
                <option value="in">Entrada (receita)</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Descrição da transação</span>
              <input value={shortcutDescription} onChange={(e) => setShortcutDescription(e.target.value)} placeholder="café, almoço, uber..." />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Valor (R$)</span>
              <input type="number" value={shortcutAmount} onChange={(e) => setShortcutAmount(e.target.value)} placeholder="0,00" min="0" step="0.01" />
            </label>
          </div>
        )}

        {/* Template fields */}
        {type === 'template' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Configuração do Template</p>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Tipo de atividade</span>
              <select value={templateActivityType} onChange={(e) => setTemplateActivityType(e.target.value)}>
                <option value="meeting">Reunião</option>
                <option value="note">Nota</option>
                <option value="call">Ligação</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Título padrão</span>
              <input value={templateText} onChange={(e) => setTemplateText(e.target.value)} placeholder="Reunião semanal de equipe" />
            </label>
          </div>
        )}

        {/* Multi fields */}
        {type === 'multi' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Sequência de Ações (até 5)</p>
            {multiActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)', minWidth: 20 }}>{i + 1}.</span>
                <select
                  value={action}
                  onChange={(e) => {
                    const updated = [...multiActions]
                    updated[i] = e.target.value
                    setMultiActions(updated)
                  }}
                  style={{ flex: 1 }}
                >
                  {MULTI_ACTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {multiActions.length > 2 && (
                  <button
                    onClick={() => setMultiActions(multiActions.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {multiActions.length < 5 && (
              <button
                onClick={() => setMultiActions([...multiActions, ''])}
                style={{ alignSelf: 'start', fontSize: '0.85em' }}
              >
                + Ação
              </button>
            )}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', margin: 0, fontSize: '0.85em' }}>❌ {error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar comando'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Settings/CommandForm.jsx
git commit -m "feat(settings): add CommandForm component for create/edit"
```

---

## Task 8: Wiring — SettingsView + OnboardingWizard

**Files:**
- Modify: `src/components/Settings/SettingsView.jsx`
- Modify: `src/components/Settings/OnboardingWizard.jsx`

- [ ] **Step 1: Adicionar aba Comandos em `SettingsView.jsx`**

Substituir o array `TABS` e adicionar import + renderização:

```jsx
// src/components/Settings/SettingsView.jsx
import { useState } from 'react'
import TelegramSection from './TelegramSection.jsx'
import CommandsSection from './CommandsSection.jsx'

const TABS = [
  { id: 'telegram', label: '🤖 Telegram' },
  { id: 'commands', label: '⚡ Comandos' },
]

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
      {activeTab === 'commands' && <CommandsSection />}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar seed em `OnboardingWizard.jsx` após conectar**

Alterar a função `handleConnect`:

```jsx
// src/components/Settings/OnboardingWizard.jsx
import { useState } from 'react'
import { saveBotConfig } from '../../lib/botConfig.js'
import { seedDefaultCommands } from '../../lib/botCommands.js'

// ... (resto do componente igual)

  async function handleConnect() {
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    try {
      await saveBotConfig({ telegramBotToken: token.trim() })
      await seedDefaultCommands()
      onConnected()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
```

Apenas o import e a função `handleConnect` mudam — o resto do componente permanece idêntico.

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings/SettingsView.jsx src/components/Settings/OnboardingWizard.jsx
git commit -m "feat(settings): wire CommandsSection tab and seed on onboarding"
```

---

## Task 9: Testes de `CommandsSection`

**Files:**
- Create: `src/components/Settings/__tests__/CommandsSection.test.jsx`

- [ ] **Step 1: Escrever testes**

```jsx
// src/components/Settings/__tests__/CommandsSection.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CommandsSection from '../CommandsSection.jsx'
import * as botCommands from '../../../lib/botCommands.js'

vi.mock('../../../lib/botCommands.js')

const MOCK_COMMANDS = [
  {
    id: 'uuid-1',
    trigger: '/saldo',
    description: 'Consulta saldo das contas',
    type: 'builtin',
    actions: [],
    examples: ['Qual o saldo?', 'Ver saldo'],
    category: 'finance',
    is_active: true,
    is_default: true,
  },
  {
    id: 'uuid-2',
    trigger: '/cafe',
    description: 'Saída rápida: café R$8',
    type: 'shortcut',
    actions: [{ action: 'finance.record', params: { direction: 'out', description: 'café', amount: 8 } }],
    examples: [],
    category: 'custom',
    is_active: true,
    is_default: true,
  },
  {
    id: 'uuid-3',
    trigger: '/meu-cmd',
    description: 'Comando do usuário',
    type: 'shortcut',
    actions: [],
    examples: [],
    category: 'custom',
    is_active: true,
    is_default: false,
  },
]

describe('CommandsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    botCommands.listCommands.mockResolvedValue(MOCK_COMMANDS)
  })

  it('mostra loading enquanto carrega', () => {
    botCommands.listCommands.mockReturnValue(new Promise(() => {}))
    render(<CommandsSection />)
    expect(screen.getByText('Carregando comandos...')).toBeTruthy()
  })

  it('exibe built-in /saldo na aba Built-in', async () => {
    render(<CommandsSection />)
    await waitFor(() => expect(screen.getByText('/saldo')).toBeTruthy())
    expect(screen.getByText('Consulta saldo das contas')).toBeTruthy()
    expect(screen.getByText(/Qual o saldo\?/)).toBeTruthy()
  })

  it('exibe comandos custom na aba Personalizados', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => expect(screen.getByText('/cafe')).toBeTruthy())
    expect(screen.getByText('/meu-cmd')).toBeTruthy()
  })

  it('chama toggleCommand ao clicar no botão de pause', async () => {
    botCommands.toggleCommand.mockResolvedValue({ ...MOCK_COMMANDS[0], is_active: false })
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('/saldo'))
    const pauseButtons = screen.getAllByText('⏸')
    fireEvent.click(pauseButtons[0])
    await waitFor(() => {
      expect(botCommands.toggleCommand).toHaveBeenCalledWith('uuid-1', false)
    })
  })

  it('mostra botão de delete apenas para is_default = false', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => screen.getByText('/meu-cmd'))
    expect(screen.getByText('🗑')).toBeTruthy() // só /meu-cmd tem delete
  })

  it('chama deleteCommand após confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    botCommands.deleteCommand.mockResolvedValue({ ok: true })
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('✨ Personalizados'))
    fireEvent.click(screen.getByText('✨ Personalizados'))
    await waitFor(() => screen.getByText('🗑'))
    fireEvent.click(screen.getByText('🗑'))
    await waitFor(() => {
      expect(botCommands.deleteCommand).toHaveBeenCalledWith('uuid-3')
    })
  })

  it('abre CommandForm ao clicar em + Novo', async () => {
    render(<CommandsSection />)
    await waitFor(() => screen.getByText('+ Novo'))
    fireEvent.click(screen.getByText('+ Novo'))
    expect(screen.getByText('Novo Comando')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar testes**

```bash
npx vitest run src/components/Settings/__tests__/CommandsSection.test.jsx
```

Expected: 7 testes passando.

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings/__tests__/CommandsSection.test.jsx
git commit -m "test(settings): add CommandsSection tests"
```

---

## Task 10: Deploy das Edge Functions

- [ ] **Step 1: Deploy `bot-commands`**

Use `mcp__plugin_supabase_supabase__deploy_edge_function` com:
- `project_id: qzljsendvthfetrntwab`
- `name: bot-commands`
- `entrypoint_path: index.ts`
- `verify_jwt: false`
- `files`: conteúdo de `supabase/functions/bot-commands/index.ts` + `supabase/functions/_shared/supabase.ts`

- [ ] **Step 2: Deploy `telegram-webhook` atualizado**

Use `mcp__plugin_supabase_supabase__deploy_edge_function` com todos os arquivos da função (incluindo o novo `utils/actions.ts`).

- [ ] **Step 3: Testar fluxo completo**

1. Abrir PettoFlow → Settings → aba "⚡ Comandos" → confirmar que lista carrega
2. Enviar `/cafe` no Telegram → esperado: `💸 Saída registrada: café — R$ 8,00`
3. Enviar `/inicio-do-dia` no Telegram → esperado: saldo + tarefas
4. Desativar `/saldo` na UI → enviar `/saldo` no Telegram → esperado: sem resposta
5. Criar novo atalho via formulário → verificar que aparece na lista

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(telegram): bot commands configuration — UI + webhook integration"
```
