# Activities & Notes — Integração Twenty → PettoFlow

**Data:** 2026-03-16
**Status:** Aprovado
**Escopo:** Módulo global de Activities com rich text, vínculos polimórficos, lembretes in-app e padrões de UI do Twenty CRM

---

## Contexto

O PettoFlow é um sistema de gestão operacional em React 18 + Vite (JSX) + Supabase. Hoje possui um feed de interações simples (texto livre) no `ClientProfileModal`. O objetivo é evoluir isso para um módulo de Activities inspirado no Twenty CRM — com rich text (Tiptap), vínculos a múltiplas entidades, timeline vertical, Command Palette, Record Sidebar deslizante e lembretes in-app — sem quebrar nenhum módulo existente.

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo do módulo | Global no sidebar + mantém feed legado | Preserva dados existentes, adiciona visão agregada |
| Vínculos | Polimórfico (clientes + tarefas + time) | Flexibilidade máxima, JSONB evita joins manuais |
| Rich text | Tiptap (lazy loaded) | Melhor DX no ecossistema React, bundle controlado |
| Lembretes | setTimeout + toast in-app | Sem Service Worker — escopo mínimo viável |
| Abordagem | Incremental Slice (sem Zustand, sem router) | Coerente com o stack atual, zero regressão |
| Skins | Adapta 3 existentes + cria `twenty` | Solicitado explicitamente pelo usuário |

---

## Schema do Banco de Dados

### Nova tabela: `activities`

```sql
CREATE TABLE activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  -- valores: 'meeting' | 'call' | 'email' | 'whatsapp' | 'note' | 'task'
  body          JSONB,
  -- documento Tiptap serializado como JSON
  status        TEXT        DEFAULT 'pending',
  -- valores: 'pending' | 'completed'
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    TEXT,                    -- sem FK intencional (MVP, sem RLS neste ciclo)
  related_to    JSONB       DEFAULT '[]',
  -- ex: [{"type":"client","id":"uuid","label":"Acme Corp"},
  --      {"type":"task","id":"uuid","label":"Implementar login"},
  --      {"type":"team","id":"uuid","label":"João Silva"}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_related_to
  ON activities USING GIN (related_to);
```

### Tabela `interaction_logs` (existente)

Mantida intacta. O `RecordSidebar` exibirá ambas as fontes separadas visualmente: "Histórico anterior" (`interaction_logs`) e "Atividades" (`activities`). Sem migração de dados neste ciclo.

---

## Arquitetura

### Novos arquivos

```
src/
├── components/
│   ├── Activities/
│   │   ├── ActivitiesView.jsx      # Tab principal — lista global de activities
│   │   ├── ActivityTimeline.jsx    # Feed vertical com linha do tempo
│   │   ├── ActivityCard.jsx        # Card individual na timeline
│   │   ├── ActivityForm.jsx        # Criar/editar com Tiptap + RelationChips
│   │   └── RelationChips.jsx       # Seletor de vínculos reutilizável
│   └── shared/
│       ├── CommandPalette.jsx      # Overlay global Ctrl+K / ⌘K
│       ├── RecordSidebar.jsx       # Painel deslizante lateral genérico
│       └── ReminderToast.jsx       # Toast de notificação (lembretes + erros)
├── hooks/
│   ├── useActivities.js            # CRUD + fetch (Supabase)
│   ├── useReminders.js             # setTimeout por scheduled_at
│   └── useCommandPalette.js        # Busca em memória + atalho de teclado
```

### Arquivos modificados

```
src/App.jsx                                    # + tab atividades, CommandPalette, ReminderToast
src/components/Sidebar.jsx                     # + item "Atividades" no nav
src/components/Clients/ClientProfileModal.jsx  # Refatorado para usar RecordSidebar
src/components/Tasks/TaskModal.jsx             # + RelationChips
src/index.css                                  # + skin twenty + variáveis derivadas + novos componentes
src/context/ThemeContext.jsx                   # + entrada twenty na lista de temas
public/index.html (via index.html)             # + font Inter
```

---

## Hierarquia de Componentes

```
App.jsx
├── <CommandPalette />     ← global, sempre montado, ouve Ctrl+K / ⌘K
├── <ReminderToast />      ← global, dispara quando scheduled_at vence
├── <Sidebar />            ← + item "Atividades"
└── <main>
    ├── <ActivitiesView /> ← novo tab
    │   ├── <ActivityTimeline />
    │   │   └── <ActivityCard /> × N
    │   └── <ActivityForm /> (modal)
    │       ├── Tiptap Editor (lazy loaded)
    │       └── <RelationChips />
    ├── <ClientesView />   ← modificado
    │   └── <RecordSidebar /> (substitui ClientProfileModal)
    │       ├── campos inline editáveis
    │       └── <ActivityTimeline /> filtrada por cliente
    └── <TaskModal />      ← + RelationChips adicionado
```

---

## Fluxo de Dados

### `useActivities.js`
- Fetch inicial ao montar: `supabase.from('activities').select('*').order('created_at', { ascending: false })`
- Expõe: `{ activities, loading, addActivity, updateActivity, deleteActivity }`
- Query filtrada por vínculo: `.contains('related_to', [{ type, id }])`
- Instanciado uma vez no `App.jsx`, passado como props onde necessário (prop-drilling explícito — sem Context wrapper por ora, coerente com o padrão atual do projeto)

### `useReminders.js`
- Recebe `activities[]` como parâmetro
- Filtra: `scheduled_at > Date.now() && status === 'pending'`
- Para cada item: `setTimeout(callback, scheduled_at - Date.now())`
- Limpa timeouts ao desmontar (cleanup no `useEffect`)
- Callback chama `onReminder({ title, type, related_to })`

### `useCommandPalette.js`
- Ouve `keydown` — detecta Mac (`metaKey + k`) vs Windows (`ctrlKey + k`)
- Busca em memória sobre `tasks[]`, `clients[]`, `activities[]` já carregados
- Resultados agrupados por tipo: Clientes / Tarefas / Atividades / Ações
- Ações rápidas: "Nova Atividade", "Novo Cliente", "Nova Tarefa"

### `RecordSidebar`
- Substitui `ClientProfileModal` — slide-in pela direita
- Lista de clientes permanece visível por trás (não bloqueia tela)
- Exibe: dados do cliente + `interaction_logs` legados + `ActivityTimeline` filtrada
- Abaixo de 768px: abre em fullscreen

### `RelationChips`
- Props: `value: Array<{type, id, label}>`, `onChange`, `clients`, `tasks`, `team`
- Input de busca inline com dropdown de sugestões
- Cores por tipo: cliente=roxo, tarefa=verde, time=amarelo
- Em `ActivityForm` e `TaskModal`

---

## Sistema de Skins

### Nova skin `twenty`

```css
[data-theme="twenty"] {
  --bg-main:        #1C1C1C;
  --bg-sidebar:     #191919;
  --text-main:      #EDEDED;
  --text-secondary: #888888;
  --card-bg:        #242424;
  --border-color:   #2E2E2E;
  --primary:        #FFFFFF;
  --primary-light:  #2A2A2A;
  --success:        #34D399;
  --warning:        #FBBF24;
  --danger:         #F87171;
  --font-sans:      'Inter', system-ui, sans-serif;
  --font-serif:     'Inter', system-ui, sans-serif;
  --radius-sm:      4px;
  --radius-md:      6px;
  --radius-lg:      10px;
  --radius-full:    9999px;
  --shadow-sm:      0 1px 3px rgba(0,0,0,.5);
  --shadow-md:      0 4px 12px rgba(0,0,0,.6);
  --shadow-lg:      0 16px 48px rgba(0,0,0,.7);
  --shadow-hover:   0 2px 8px rgba(0,0,0,.5);
  --border-width:   1px;
  --timeline-line:  #3E3E3E;
  --chip-bg:        #2A2A2A;
  --sidebar-overlay: rgba(0,0,0,.6);
}
```

### Variáveis derivadas (adicionadas em todos os temas)

```css
/* ledger */  --timeline-line: var(--border-color); --chip-bg: var(--primary-light); --sidebar-overlay: rgba(0,0,0,.2);
/* classic */ --timeline-line: var(--border-color); --chip-bg: var(--primary-light); --sidebar-overlay: rgba(0,0,0,.3);
/* dark */    --timeline-line: #334155;              --chip-bg: #312E81;              --sidebar-overlay: rgba(0,0,0,.5);
```

### Ajustes por skin nos novos componentes

| Skin | ActivityCard | CommandPalette | RelationChips | RecordSidebar |
|---|---|---|---|---|
| `ledger` | sem border-radius, borda preta 1px | borda 2px preta, sombra offset | chips retangulares (radius 0) | borda esquerda 2px sólida |
| `classic` | radius-md, sombra suave | radius-lg, sombra difusa | chips pill (radius-full) | sombra lateral suave |
| `dark` | radius-md, fundo card-bg | backdrop blur, fundo card-bg | chips com fundo primary-light | overlay escuro |
| `twenty` | radius-sm, borda border-color | sem blur, fundo #1F1F1F | chips radius-sm, fundo chip-bg | overlay sidebar-overlay |

> **Nota `twenty`:** `--font-serif` é intencionalmente igual a `--font-sans` (`'Inter'`) — o Twenty CRM usa uma única typeface sans em toda a UI.

---

## Tratamento de Erros

- **Supabase errors**: `console.error` + `ReminderToast` com `variant="error"` (sem `alert()`)
- **Tiptap JSON inválido**: fallback para exibir `title` apenas, sem crash
- **Chips órfãos** (registro deletado): exibe label original do JSON + ícone `⚠` discreto
- **Lembretes expirados** (página fechada e reaberta): `useReminders` recalcula ao montar — lembretes passados não disparam (filtro `> Date.now()`)
- **CommandPalette sem resultados**: mensagem "Nenhum resultado para '...'" + ação "Criar nova atividade"

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Tiptap ~150kb no bundle | Lazy import: `await import('@tiptap/react')` ao abrir ActivityForm |
| App.jsx cresce | `useActivities` extrai toda lógica — App recebe só o hook |
| Conflito de atalho Ctrl+K | Fallback `/` como alternativa; detecta plataforma |
| RecordSidebar em mobile | Fullscreen abaixo de 768px |
| Chips órfãos sem cascade delete | Label preservado no JSON, ícone de aviso |
| `setTimeout` com aba aberta por dias | Limite prático ~24 dias — irrelevante para uso típico de CRM |

---

## Fora de Escopo (este ciclo)

- Notificações push / Service Worker
- Busca full-text no corpo Tiptap (CommandPalette busca só por título)
- Migração de `interaction_logs` para `activities`
- People/Contacts individuais (sub-projeto separado)
- Row Level Security no Supabase
- Testes automatizados

---

## Dependências Novas

```json
"@tiptap/react": "^2.x",
"@tiptap/starter-kit": "^2.x"
```

Tiptap starter-kit inclui: Bold, Italic, Lists, Blockquote, Code, HardBreak, Heading — suficiente para notes de CRM.
