# Bot Commands Configuration — Design Spec

**Data:** 2026-04-03
**Status:** Aprovado
**Branch alvo:** `feat/telegram-bot`

---

## Contexto

O bot do Telegram do PettoFlow já possui 15 ações mapeadas (tarefas, atividades, finanças) via slash commands hardcoded (`parseSlash`) e linguagem natural (NLP via Gemini/OpenAI/Anthropic). O objetivo desta feature é criar uma área de configuração no app que permita:

1. Visualizar e ativar/desativar todos os comandos existentes
2. Criar comandos customizados (atalhos, templates, multi-ação)
3. Seedar comandos padrão úteis na criação do bot

---

## Decisões de Design

| Questão | Decisão | Razão |
|---|---|---|
| Onde armazenar | Supabase — nova tabela `bot_commands` | Sem redeploy, CRUD simples, consistente com `bot_configs` |
| Quem pode criar | Somente via interface do app (Settings) | Controle centralizado, sem comandos criados pelo Telegram |
| Comandos padrão | Seedados no onboarding | Funciona bem desde o primeiro uso |
| Execução | Direto (shortcut/template/multi) com fallback NLP | Funciona sem LLM configurado para comandos simples |

---

## Modelo de Dados

### Tabela `bot_commands`

```sql
create table bot_commands (
  id            uuid primary key default gen_random_uuid(),
  bot_config_id uuid references bot_configs(id) on delete cascade not null,
  trigger       text not null,         -- ex: '/cafe', '/fim-de-dia'
  description   text not null,         -- exibido na UI e no /ajuda
  type          text not null          -- 'builtin' | 'shortcut' | 'template' | 'multi'
                  check (type in ('builtin', 'shortcut', 'template', 'multi')),
  actions       jsonb not null,         -- array de action objects
  examples      text[],                -- frases de linguagem natural (documentação)
  category      text not null,         -- 'tasks' | 'activities' | 'finance' | 'custom'
  is_active     boolean default true,
  is_default    boolean default true,   -- true = seedado, false = criado pelo usuário
  created_at    timestamptz default now()
);

-- RLS: acesso via service role key (Edge Function)
alter table bot_commands enable row level security;
```

### Estrutura do campo `actions` (JSONB)

```jsonc
// shortcut — todos os params preenchidos, execução direta
[{ "action": "finance.record", "params": { "direction": "out", "description": "café", "amount": 8.00 }}]

// template — params parciais, execução direta com dados pré-definidos
[{ "action": "activities.log", "params": { "type": "meeting", "text": "Reunião semanal de equipe" }}]

// multi — encadeia múltiplas ações, respostas concatenadas
[
  { "action": "tasks.list",    "params": {} },
  { "action": "finance.list",  "params": {} }
]

// builtin — sem actions (execução via parseSlash/NLP), usado só para controle de ativação
[]
```

---

## Comandos Seedados

### Built-ins (`type: 'builtin'`) — referência, só toggle

| Trigger | Descrição | Exemplos NLP | Categoria |
|---|---|---|---|
| `/tarefa` | Cria uma nova tarefa | "Cria uma tarefa de...", "Adiciona tarefa..." | tasks |
| `/tarefas` | Lista tarefas pendentes | "Quais minhas tarefas?", "Ver tarefas" | tasks |
| `/ok` | Conclui uma tarefa | — | tasks |
| `/prioridade` | Define prioridade de tarefa | — | tasks |
| `/nota` | Registra uma nota | "Anota que...", "Registra nota..." | activities |
| `/reuniao` | Registra uma reunião | "Agende uma reunião para...", "Tive reunião com..." | activities |
| `/ligacao` | Registra uma ligação | "Liguei para...", "Registra ligação com..." | activities |
| `/atividades` | Lista atividades recentes | "Minhas atividades", "O que fiz hoje?" | activities |
| `/pagar` | Registra uma saída financeira | "Paguei R$X de...", "Gastei R$X com..." | finance |
| `/recebi` | Registra uma entrada financeira | "Recebi R$X de...", "Entrada de R$X" | finance |
| `/saldo` | Consulta saldo das contas | "Qual o saldo?", "Ver saldo" | finance |
| `/extrato` | Lista últimas transações | "Últimas transações", "Ver extrato" | finance |

### Customizados pré-configurados (`type: shortcut|template|multi`) — editáveis e deletáveis

| Trigger | Tipo | Ação | Descrição |
|---|---|---|---|
| `/cafe` | shortcut | finance.record out R$8 | Saída rápida "café" |
| `/almoco` | shortcut | finance.record out R$35 | Saída rápida "almoço" |
| `/reuniao-semanal` | template | activities.log meeting | Registra "Reunião semanal de equipe" |
| `/inicio-do-dia` | multi | finance.balance + tasks.list | Saldo + tarefas ao começar o dia |
| `/fim-de-dia` | multi | tasks.list + finance.list | Pendências + extrato ao encerrar |

---

## Arquitetura de UI

### Novos componentes

```
src/components/Settings/
├── CommandsSection.jsx     # Tela principal com abas built-in / personalizados
└── CommandForm.jsx         # Formulário criar/editar comando customizado
src/lib/
└── botCommands.js          # Client CRUD para tabela bot_commands
```

### Integração em `SettingsView.jsx`

Nova aba "⚡ Comandos" adicionada ao array `TABS`:

```jsx
const TABS = [
  { id: 'telegram', label: '🤖 Telegram' },
  { id: 'commands', label: '⚡ Comandos' },  // novo
]
```

### Layout de `CommandsSection`

```
┌─────────────────────────────────────────────┐
│ ⚡ Comandos do Bot                          │
│ Gerencie e crie comandos personalizados     │
├─────────────────────────────────────────────┤
│ [🔧 Built-in] [✨ Personalizados]  [+ Novo] │
├─────────────────────────────────────────────┤
│ TAREFAS                                     │
│ ● /tarefa    Cria uma nova tarefa    [⏸]   │
│   💬 "Cria uma tarefa de reunião..."        │
│ ● /tarefas   Lista tarefas pendentes [⏸]   │
├─────────────────────────────────────────────┤
│ FINANÇAS                                    │
│ ● /saldo     Consulta saldo          [⏸]   │
│   💬 "Qual o saldo?", "Ver saldo"           │
├─────────────────────────────────────────────┤
│ PERSONALIZADOS                              │
│ ● /cafe        Saída R$8 café  [✏️][🗑][⏸] │
│ ● /fim-de-dia  Resumo do dia   [✏️][🗑][⏸] │
│                                             │
│ [+ Adicionar comando]                       │
└─────────────────────────────────────────────┘
```

### Formulário `CommandForm` — campos por tipo

**Shortcut:** trigger + descrição + ação (select) + params fixos (descrição, valor, direção)
**Template:** trigger + descrição + tipo de atividade + título padrão
**Multi:** trigger + descrição + lista ordenada de ações (até 5)

---

## Fluxo de Execução no Webhook

```
Mensagem recebida
      ↓
 Voz? → transcrever → "🎤 Ouvi: ..."
      ↓
1. Carregar bot_commands ativos do banco (filter: bot_config_id + is_active = true)
      ↓
2. Trigger exato bate em bot_commands?
   ├── Sim, type ≠ 'builtin' → executeActions(actions[]) → responder
   ├── Sim, type = 'builtin' e is_active = false → ignorar (não passa adiante)
   └── Não ↓
3. parseSlash() — built-ins hardcoded
   ├── Match → executar → responder
   └── Não ↓
4. parseWithLLM() — NLP
   ├── Match → executar → responder
   └── Não → "🤔 Não entendi. Tente /ajuda"
```

### Nova função `executeActions()` — `utils/actions.ts`

```typescript
export async function executeActions(
  sb: SupabaseClient,
  chatId: string,
  actions: Array<{ action: string; params: Record<string, unknown> }>
): Promise<string> {
  const results: string[] = []
  for (const { action, params } of actions) {
    switch (action) {
      case 'finance.record':
        results.push(await recordTransaction(sb, params.direction, params.description, params.amount))
        break
      case 'finance.balance':
        results.push(await getBalance(sb))
        break
      case 'finance.list':
        results.push(await listTransactions(sb))
        break
      case 'tasks.list':
        results.push(await listTasks(sb, chatId))
        break
      case 'tasks.create':
        results.push(await createTask(sb, params.title as string))
        break
      case 'activities.log':
        results.push(await logActivity(sb, params.type as string, params.text as string))
        break
      case 'activities.list':
        results.push(await listActivities(sb))
        break
    }
  }
  return results.join('\n\n')
}
```

---

## Seed no Onboarding

Ao finalizar o `OnboardingWizard` (criação do `bot_config`), chamar `seedDefaultCommands(botConfigId)` que insere todos os built-ins e custom pré-configurados na tabela `bot_commands`.

---

## Escopo Completo de Entregáveis

| Entregável | Arquivo | Descrição |
|---|---|---|
| Migration SQL | `supabase/migrations/YYYYMMDD_bot_commands.sql` | Tabela + RLS |
| Seed function | `src/lib/botCommands.js` | `seedDefaultCommands()` |
| CRUD client | `src/lib/botCommands.js` | list, create, update, toggle, delete |
| Tela principal | `src/components/Settings/CommandsSection.jsx` | Abas + lista + toggle |
| Formulário | `src/components/Settings/CommandForm.jsx` | Criar/editar por tipo |
| SettingsView | `src/components/Settings/SettingsView.jsx` | Nova aba Comandos |
| Executor | `supabase/functions/telegram-webhook/utils/actions.ts` | `executeActions()` |
| Webhook | `supabase/functions/telegram-webhook/index.ts` | Resolver custom commands antes de parseSlash |

---

## Fora de Escopo

- Cache de `bot_commands` em memória (otimização futura)
- Comandos criados via Telegram
- Múltiplos usuários com permissões diferentes
- Versionamento/histórico de comandos
