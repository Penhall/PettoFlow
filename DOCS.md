# PettoFlow — Documentação Técnica

> Última atualização: 2026-03-16

---

## Visão Geral

PettoFlow é um CRM/gestão de tarefas para pequenas equipes, construído com React 18 + Vite + Supabase. Oferece kanban, linha do tempo de atividades, gestão de clientes e time, com suporte a 4 temas visuais.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| UI | React 18, Framer Motion, Lucide React |
| Build | Vite 5 |
| Backend/DB | Supabase JS v2 (PostgreSQL) |
| Editor de texto | Tiptap v2 (`@tiptap/react`, `@tiptap/starter-kit`) |
| Drag & Drop | dnd-kit (`core`, `sortable`, `utilities`) |
| Estilo | CSS puro com custom properties (4 temas) |

---

## Estrutura de Arquivos

```
src/
├── main.jsx                        # Entry point; envolve App com ThemeProvider
├── App.jsx                         # Orquestrador principal: tabs, modais, CRUD de tarefas
├── index.css                       # CSS global com 4 paletas de tema
│
├── context/
│   └── ThemeContext.jsx             # Context do tema; persiste em localStorage
│
├── lib/
│   └── supabaseClient.js            # Inicialização do cliente Supabase
│
├── hooks/
│   ├── useActivities.js             # CRUD de atividades no Supabase
│   ├── useCommandPalette.js         # Estado e busca do Command Palette (Ctrl+K)
│   └── useReminders.js              # setTimeout para lembretes de atividades agendadas
│
└── components/
    ├── Sidebar.jsx                  # Nav lateral (Dashboard, Tarefas, Atividades, Time, Clientes)
    ├── Header.jsx                   # Cabeçalho: título, busca, seletor de tema, exportar
    │
    ├── Activities/
    │   ├── ActivitiesView.jsx       # Container: timeline + botão Nova Atividade
    │   ├── ActivityCard.jsx         # Card de uma atividade (badge tipo, preview, ações)
    │   ├── ActivityForm.jsx         # Modal de criação/edição com Tiptap lazy-loaded
    │   ├── ActivityTimeline.jsx     # Lista vertical de cards com linha de timeline
    │   └── RelationChips.jsx        # Multi-select para vincular a clientes/tarefas/membros
    │
    ├── Tasks/
    │   ├── KanbanView.jsx           # Kanban drag-and-drop (dnd-kit)
    │   ├── ListView.jsx             # Listagem tabular de tarefas
    │   ├── OverviewView.jsx         # Visão de estatísticas de tarefas
    │   └── TaskModal.jsx            # Modal de criação/edição com RelationChips
    │
    ├── Clients/
    │   ├── ClientesView.jsx         # Grid de clientes + modal de edição
    │   └── ClientProfileModal.jsx   # Perfil do cliente via RecordSidebar (painel lateral)
    │
    ├── Team/
    │   └── TimeView.jsx             # Gestão de membros do time
    │
    ├── Dashboard/
    │   └── Dashboard.jsx            # Cards de métricas, gráficos, tarefas recentes
    │
    └── shared/
        ├── CommandPalette.jsx       # Overlay de busca global (Ctrl+K / Cmd+K)
        ├── RecordSidebar.jsx        # Painel deslizante lateral (slide-in da direita)
        └── ReminderToast.jsx        # Toast de lembretes + hook useErrorToast()
```

---

## Banco de Dados (Supabase)

### Tabelas

#### `activities`
```sql
id           BIGINT PK GENERATED ALWAYS AS IDENTITY
title        TEXT NOT NULL
type         TEXT CHECK (meeting | call | email | whatsapp | note | task)
body         JSONB                        -- conteúdo Tiptap (JSON)
status       TEXT DEFAULT 'pending'       -- pending | completed
scheduled_at TIMESTAMPTZ                  -- para lembretes
created_by   TEXT
related_to   JSONB DEFAULT '[]'           -- [{type, id, label}, ...]
created_at   TIMESTAMPTZ DEFAULT NOW()
```

#### `tasks`
```sql
id           BIGINT PK
title        TEXT
status       TEXT      -- 'A Fazer' | 'Em Progresso' | 'Concluído'
priority     TEXT      -- 'Alta' | 'Média' | 'Baixa'
owner        TEXT
tags         TEXT[]
progress     INTEGER
deal_value   NUMERIC
client_id    BIGINT FK → clients
member_id    BIGINT FK → team
category     TEXT      -- 'Operacional' | 'Vendas' | 'Pessoal'
related_to   JSONB
created_at   TIMESTAMPTZ
```

#### `clients`
```sql
id           BIGINT PK
name         TEXT
industry     TEXT
status       TEXT      -- 'Ativo' | 'Em negociação' | 'Inativo'
email        TEXT
phone        TEXT
company_size TEXT
revenue      TEXT
projects     INTEGER
lead_status  TEXT      -- 'Lead' | 'Oportunidade' | 'Cliente' | 'Inativo'
```

#### `team`
```sql
id         BIGINT PK
name       TEXT
role       TEXT
avatar_url TEXT
phone      TEXT
```

#### `kanban_columns`
```sql
id          BIGINT PK
name        TEXT UNIQUE
order_index INTEGER
color       TEXT DEFAULT '#7C3AED'
```

#### `interaction_logs`
```sql
id        BIGINT PK
client_id BIGINT FK → clients ON DELETE CASCADE
task_id   BIGINT FK → tasks ON DELETE SET NULL
member_id BIGINT FK → team ON DELETE SET NULL
type      TEXT CHECK (Ligação | Email | Reunião | WhatsApp | Outro)
notes     TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
```

> Todas as tabelas têm RLS habilitado com políticas de acesso público (SELECT/INSERT/UPDATE/DELETE).

### Arquivos SQL
| Arquivo | Conteúdo |
|---|---|
| `supabase_activities.sql` | Criação da tabela `activities` |
| `supabase_update_sales.sql` | Criação da tabela `interaction_logs` |
| `supabase_update_crm.sql` | Criação da tabela `kanban_columns`; alterações em `tasks`, `clients`, `team` |

---

## Sistema de Temas

Quatro temas controlados via atributo `data-theme` no elemento raiz, persistidos em `localStorage` como `pettoflow_theme`.

| ID | Nome | Descrição |
|---|---|---|
| `ledger` | Ledger (padrão) | Minimalista preto e branco |
| `classic` | Classic | SaaS moderno com roxo |
| `dark` | Dark | Modo escuro com índigo |
| `twenty` | Twenty (Grafite) | Tons de cinza, inspirado no Twenty CRM |

### Variáveis CSS por categoria

| Categoria | Variáveis |
|---|---|
| Fundos | `--bg-main`, `--bg-sidebar`, `--card-bg` |
| Texto | `--text-main`, `--text-secondary` |
| Acento | `--primary`, `--primary-light`, `--success`, `--warning`, `--danger` |
| Bordas | `--border-color`, `--border-width` |
| Tipografia | `--font-sans`, `--font-serif` |
| Forma | `--radius-sm/md/lg/full`, `--shadow-sm/md/lg/hover` |
| Componentes | `--timeline-line`, `--chip-bg`, `--sidebar-overlay` |

---

## Hooks Customizados

### `useActivities()`
Gerencia o estado e CRUD da tabela `activities`.

```js
const {
  activities,       // Activity[]
  loading,          // boolean
  addActivity,      // (activity) => Promise<Activity | null>
  updateActivity,   // (id, updates) => Promise<Activity | null>
  deleteActivity,   // (id) => Promise<boolean>
  getActivitiesFor, // (type, id) => Activity[]  — filtra por related_to
} = useActivities()
```

### `useCommandPalette(tasks, clients, activities)`
Command palette global com atalho de teclado.

```js
const {
  isOpen,    // boolean
  query,     // string
  setQuery,  // (string) => void
  results,   // Array<{type, id, label, sub}>  — máx 3 por tipo
  open,      // () => void
  close,     // () => void
} = useCommandPalette(tasks, clients, activities)
```

Atalho: `Ctrl+K` (Windows/Linux) ou `Cmd+K` (Mac). `Escape` fecha.

### `useReminders(activities, onReminder)`
Agenda lembretes via `setTimeout` para atividades com `scheduled_at` futuro e `status === 'pending'`.

```js
useReminders(activities, ({ title, type, related_to, id }) => {
  // disparado quando o momento chega
})
```

### `useErrorToast()` *(exportado de ReminderToast)*
Toast manual para erros.

```js
const { toasts, showError } = useErrorToast()
showError('Título', 'Subtítulo opcional')
```

---

## Componentes Principais

### `ActivityForm`
Modal completo para criação e edição de atividades.

**Props:**
```js
activity     // Activity | null — se fornecido, entra em modo edição
onSave       // (form) => void
onClose      // () => void
clients      // Client[]  — default []
tasks        // Task[]    — default []
team         // Member[]  — default []
```

O editor Tiptap é carregado via `React.lazy()` + `Promise.all` para evitar bloqueio do bundle principal. O `onChange` usa `useRef` para estabilidade sem re-criar o editor.

### `RecordSidebar`
Painel deslizante da direita, substituindo modais de detalhe.

**Props:**
```js
isOpen    // boolean
onClose   // () => void — default () => {}
title     // string
subtitle  // string (opcional)
children  // ReactNode
```

### `RelationChips`
Multi-select com busca para vincular registros.

**Props:**
```js
value     // Array<{type, id, label}>
onChange  // (Array<{type, id, label}>) => void
clients   // Client[]
tasks     // Task[]
team      // Member[]
```

Tipos suportados: `client` 🏢, `task` ✅, `team` 👤.

### `CommandPalette`
Overlay de busca global.

**Props:**
```js
isOpen           // boolean
query            // string
setQuery         // (string) => void
results          // Array<{type, id, label, sub}>
onClose          // () => void
onSelect         // (item) => void
onCreateActivity // () => void
```

---

## Fluxo de Navegação

```
App
└── Tab ativo (activeTab state)
    ├── 'dashboard'  → Dashboard
    ├── 'tarefas'    → KanbanView | ListView | OverviewView + TaskModal
    ├── 'atividades' → ActivitiesView + ActivityForm
    ├── 'time'       → TimeView
    └── 'clientes'   → ClientesView + ClientProfileModal (RecordSidebar)

Overlay global (sempre montado)
├── CommandPalette  (Ctrl+K)
└── ReminderToast   (canto inferior direito)
```

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anon do Supabase |

Configure em `.env` local ou nas variáveis de ambiente do Vercel.
