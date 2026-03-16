# Activities & Notes — Twenty Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar módulo global de Activities ao PettoFlow com rich text (Tiptap), vínculos polimórficos, Command Palette, Record Sidebar deslizante, lembretes in-app e nova skin "twenty".

**Architecture:** Incremental Slice — novos componentes isolados em `src/components/Activities/` e `src/components/shared/`, lógica extraída em hooks em `src/hooks/`, integrados ao App.jsx sem state management externo. Schema Supabase estendido com tabela `activities` (JSONB polimórfico).

**Tech Stack:** React 18 + Vite (JSX), Supabase JS v2, Tiptap v2 (lazy loaded), Framer Motion, Lucide React, CSS custom properties.

> **⚠️ Sem infraestrutura de testes:** O projeto não possui Vitest/Jest. Cada tarefa usa verificação manual no browser (http://localhost:5173) em vez de testes automatizados.

**Spec:** `docs/superpowers/specs/2026-03-16-activities-notes-twenty-integration-design.md`

---

## Chunk 1: Foundation — DB, Hooks e Sistema de Skins

---

### Task 1: Criar tabela `activities` no Supabase

**Files:**
- Reference: Supabase Dashboard SQL Editor

- [ ] **Step 1: Abrir o Supabase Dashboard e navegar para SQL Editor**

- [ ] **Step 2: Executar o SQL de criação da tabela**

```sql
CREATE TABLE activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  body          JSONB,
  status        TEXT        DEFAULT 'pending',
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    TEXT,
  related_to    JSONB       DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 3: Criar índice GIN para busca por vínculo**

```sql
CREATE INDEX idx_activities_related_to
  ON activities USING GIN (related_to);
```

- [ ] **Step 4: Verificar no Table Editor que a tabela foi criada com todas as colunas**

Expected: tabela `activities` visível com 10 colunas.

- [ ] **Step 5: Inserir registro de teste para validar o schema**

```sql
INSERT INTO activities (title, type, related_to)
VALUES (
  'Teste de schema',
  'note',
  '[{"type":"client","id":"00000000-0000-0000-0000-000000000000","label":"Teste"}]'
);
```

Expected: inserção sem erros, UUID gerado automaticamente.

- [ ] **Step 6: Deletar o registro de teste**

```sql
DELETE FROM activities WHERE title = 'Teste de schema';
```

---

### Task 2: Instalar Tiptap

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar dependências do Tiptap**

```bash
npm install @tiptap/react @tiptap/starter-kit
```

Expected output: `added X packages` sem erros.

- [ ] **Step 2: Verificar que o servidor de dev ainda sobe**

```bash
npm run dev
```

Expected: `VITE v5.x ready in Xms` sem erros no terminal.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instala @tiptap/react e @tiptap/starter-kit"
```

---

### Task 3: Hook `useActivities`

**Files:**
- Create: `src/hooks/useActivities.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useActivities.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useActivities() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching activities:', error)
    else setActivities(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  const addActivity = async (activity) => {
    const { data, error } = await supabase
      .from('activities')
      .insert([{ ...activity, created_at: new Date() }])
      .select()
    if (error) { console.error('Error adding activity:', error); return null }
    setActivities(prev => [data[0], ...prev])
    return data[0]
  }

  const updateActivity = async (id, updates) => {
    const { data, error } = await supabase
      .from('activities')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
    if (error) { console.error('Error updating activity:', error); return null }
    setActivities(prev => prev.map(a => a.id === id ? data[0] : a))
    return data[0]
  }

  const deleteActivity = async (id) => {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
    if (error) { console.error('Error deleting activity:', error); return false }
    setActivities(prev => prev.filter(a => a.id !== id))
    return true
  }

  const getActivitiesFor = (type, id) =>
    activities.filter(a =>
      Array.isArray(a.related_to) &&
      a.related_to.some(r => r.type === type && r.id === String(id))
    )

  return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesFor }
}
```

- [ ] **Step 2: Verificar no browser que o app ainda funciona**

Abra http://localhost:5173 — nenhum erro no console, todos os módulos carregam normalmente. O hook ainda não está conectado a nenhum componente.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useActivities.js
git commit -m "feat: hook useActivities com CRUD e filtro polimórfico"
```

---

### Task 4: Hook `useReminders`

**Files:**
- Create: `src/hooks/useReminders.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useReminders.js
import { useEffect, useRef } from 'react'

export function useReminders(activities, onReminder) {
  const timersRef = useRef([])

  useEffect(() => {
    // Limpar timers anteriores
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const now = Date.now()
    const pending = (activities || []).filter(
      a => a.scheduled_at && a.status === 'pending' && new Date(a.scheduled_at).getTime() > now
    )

    pending.forEach(activity => {
      const delay = new Date(activity.scheduled_at).getTime() - now
      const timerId = setTimeout(() => {
        onReminder({
          title: activity.title,
          type: activity.type,
          related_to: activity.related_to,
          id: activity.id,
        })
      }, delay)
      timersRef.current.push(timerId)
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [activities, onReminder])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useReminders.js
git commit -m "feat: hook useReminders com setTimeout por scheduled_at"
```

---

### Task 5: Hook `useCommandPalette`

**Files:**
- Create: `src/hooks/useCommandPalette.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useCommandPalette.js
import { useState, useEffect, useCallback } from 'react'

export function useCommandPalette(tasks, clients, activities) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const trigger = isMac ? e.metaKey && e.key === 'k' : e.ctrlKey && e.key === 'k'
      if (trigger) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const open = useCallback(() => { setIsOpen(true); setQuery('') }, [])
  const close = useCallback(() => { setIsOpen(false); setQuery('') }, [])

  const results = useCallback(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const matchedClients = (clients || [])
      .filter(c => (c.name || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ type: 'client', id: c.id, label: c.name, sub: c.industry }))
    const matchedTasks = (tasks || [])
      .filter(t => (t.title || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(t => ({ type: 'task', id: t.id, label: t.title, sub: t.status }))
    const matchedActivities = (activities || [])
      .filter(a => (a.title || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(a => ({ type: 'activity', id: a.id, label: a.title, sub: a.type }))
    return [...matchedClients, ...matchedTasks, ...matchedActivities]
  }, [query, tasks, clients, activities])

  return { isOpen, query, setQuery, open, close, results }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCommandPalette.js
git commit -m "feat: hook useCommandPalette com busca em memória e atalho Ctrl+K"
```

---

### Task 6: Sistema de skins — skin `twenty` + variáveis derivadas

**Files:**
- Modify: `src/index.css`
- Modify: `src/context/ThemeContext.jsx`
- Modify: `index.html`

- [ ] **Step 1: Adicionar font Inter ao `index.html`**

Localizar a linha com a importação das fontes atuais (linha ~10) e adicionar Inter:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Adicionar variáveis derivadas aos 3 temas existentes em `src/index.css`**

Ao final do bloco `:root, [data-theme="ledger"]`, adicionar:
```css
  --timeline-line:    var(--border-color);
  --chip-bg:          var(--primary-light);
  --sidebar-overlay:  rgba(0,0,0,.2);
```

Ao final do bloco `[data-theme="classic"]`, adicionar:
```css
  --timeline-line:    var(--border-color);
  --chip-bg:          var(--primary-light);
  --sidebar-overlay:  rgba(0,0,0,.3);
```

Ao final do bloco `[data-theme="dark"]`, adicionar:
```css
  --timeline-line:    #334155;
  --chip-bg:          #312E81;
  --sidebar-overlay:  rgba(0,0,0,.5);
```

- [ ] **Step 3: Adicionar bloco `[data-theme="twenty"]` em `src/index.css`** após o bloco dark:

```css
[data-theme="twenty"] {
  --bg-main:          #1C1C1C;
  --bg-sidebar:       #191919;
  --text-main:        #EDEDED;
  --text-secondary:   #888888;
  --card-bg:          #242424;
  --border-color:     #2E2E2E;
  --primary:          #FFFFFF;
  --primary-light:    #2A2A2A;
  --success:          #34D399;
  --warning:          #FBBF24;
  --danger:           #F87171;
  --font-sans:        'Inter', system-ui, sans-serif;
  --font-serif:       'Inter', system-ui, sans-serif;
  --radius-sm:        4px;
  --radius-md:        6px;
  --radius-lg:        10px;
  --radius-full:      9999px;
  --shadow-sm:        0 1px 3px rgba(0,0,0,.5);
  --shadow-md:        0 4px 12px rgba(0,0,0,.6);
  --shadow-lg:        0 16px 48px rgba(0,0,0,.7);
  --shadow-hover:     0 2px 8px rgba(0,0,0,.5);
  --border-width:     1px;
  --timeline-line:    #3E3E3E;
  --chip-bg:          #2A2A2A;
  --sidebar-overlay:  rgba(0,0,0,.6);
}
```

- [ ] **Step 4: Adicionar skin `twenty` ao `ThemeContext.jsx`**

Localizar o array `themes` (linha ~22) e adicionar a entrada:

```js
{ id: 'twenty', name: 'Twenty (Grafite)' },
```

- [ ] **Step 5: Verificar no browser**

Abra http://localhost:5173, abra o seletor de tema na sidebar/header e confirme que "Twenty (Grafite)" aparece. Selecione-o e verifique que o app muda para o tema escuro grafite.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/context/ThemeContext.jsx index.html
git commit -m "feat: skin twenty + variáveis CSS derivadas para novos componentes"
```

---

## Chunk 2: Componentes Reutilizáveis

---

### Task 7: Componente `RelationChips`

**Files:**
- Create: `src/components/Activities/RelationChips.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Activities/RelationChips.jsx
import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'

const TYPE_COLORS = {
  client:   { bg: 'var(--chip-bg)', label: '🏢' },
  task:     { bg: 'var(--chip-bg)', label: '✅' },
  team:     { bg: 'var(--chip-bg)', label: '👤' },
}

const RelationChips = ({ value = [], onChange, clients = [], tasks = [], team = [] }) => {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)

  const allOptions = [
    ...clients.map(c => ({ type: 'client', id: String(c.id), label: c.name })),
    ...tasks.map(t => ({ type: 'task',   id: String(t.id), label: t.title })),
    ...team.map(m => ({ type: 'team',   id: String(m.id), label: m.name })),
  ]

  const filtered = search.trim()
    ? allOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) &&
        !value.some(v => v.type === o.type && v.id === o.id)
      ).slice(0, 6)
    : []

  const addChip = (option) => {
    onChange([...value, option])
    setSearch('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const removeChip = (index) => {
    onChange(value.filter((_, i) => i !== index))
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.relation-chips-wrapper')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relation-chips-wrapper">
      <div className="relation-chips">
        {value.map((chip, i) => (
          <span key={`${chip.type}-${chip.id}`} className="relation-chip">
            {TYPE_COLORS[chip.type]?.label || '🔗'} {chip.label}
            <button
              type="button"
              className="chip-remove"
              onClick={() => removeChip(i)}
              aria-label={`Remover ${chip.label}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="chip-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chip-input"
            placeholder={value.length === 0 ? 'Vincular a cliente, tarefa ou membro...' : 'Adicionar...'}
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => search && setShowDropdown(true)}
          />
        </div>
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="chip-dropdown">
          {filtered.map(opt => (
            <button
              key={`${opt.type}-${opt.id}`}
              type="button"
              className="chip-option"
              onClick={() => addChip(opt)}
            >
              {TYPE_COLORS[opt.type]?.label} {opt.label}
              <span className="chip-option-type">{opt.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default RelationChips
```

- [ ] **Step 2: Adicionar estilos em `src/index.css`** (ao final do arquivo):

```css
/* ─── RelationChips ─── */
.relation-chips-wrapper { position: relative; }

.relation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 38px;
  padding: 6px 10px;
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  cursor: text;
}

.relation-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: var(--chip-bg);
  color: var(--text-main);
  font-size: 12px;
  border: var(--border-width) solid var(--border-color);
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  display: flex;
  align-items: center;
}
.chip-remove:hover { color: var(--danger); }

.chip-input-wrapper { flex: 1; min-width: 120px; }
.chip-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-main);
}
.chip-input::placeholder { color: var(--text-secondary); }

.chip-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 100;
  overflow: hidden;
}

.chip-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  font-family: var(--font-sans);
}
.chip-option:hover { background: var(--primary-light); }

.chip-option-type {
  margin-left: auto;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Verificação rápida no browser**

O componente não está montado em nenhum lugar ainda — verifique só que o app não quebra em http://localhost:5173 e o console está limpo.

- [ ] **Step 4: Commit**

```bash
git add src/components/Activities/RelationChips.jsx src/index.css
git commit -m "feat: componente RelationChips com busca e vínculos polimórficos"
```

---

### Task 8: Componente `ReminderToast`

**Files:**
- Create: `src/components/shared/ReminderToast.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/shared/ReminderToast.jsx
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, AlertCircle } from 'lucide-react'
import { useReminders } from '../../hooks/useReminders'

const VARIANT_ICONS = {
  reminder: Bell,
  error: AlertCircle,
}

const Toast = ({ toast, onDismiss }) => {
  const Icon = VARIANT_ICONS[toast.variant] || Bell
  return (
    <motion.div
      className={`reminder-toast toast-${toast.variant}`}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.2 }}
    >
      <div className="toast-icon"><Icon size={16} /></div>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.sub && <span className="toast-sub">{toast.sub}</span>}
      </div>
      <button className="toast-close" onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
    </motion.div>
  )
}

const ReminderToast = ({ activities }) => {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((reminder) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { ...reminder, id, variant: 'reminder' }])
    setTimeout(() => dismiss(id), 8000)
  }, [dismiss])

  useReminders(activities, addToast)

  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Exporta também função utilitária para toasts de erro manuais
export function useErrorToast() {
  const [toasts, setToasts] = useState([])
  const showError = useCallback((title, sub) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, title, sub, variant: 'error' }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }, [])
  return { toasts, showError }
}

export default ReminderToast
```

- [ ] **Step 2: Adicionar estilos ao `src/index.css`**

```css
/* ─── ReminderToast ─── */
.toast-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.reminder-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  box-shadow: var(--shadow-md);
  max-width: 320px;
  pointer-events: all;
}

.toast-reminder .toast-icon { color: var(--warning); }
.toast-error .toast-icon { color: var(--danger); }

.toast-body { flex: 1; }
.toast-title { display: block; font-size: 13px; font-weight: 500; color: var(--text-main); }
.toast-sub { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  display: flex;
  align-items: center;
}
.toast-close:hover { color: var(--text-main); }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ReminderToast.jsx src/index.css
git commit -m "feat: componente ReminderToast com suporte a lembretes e erros"
```

---

### Task 9: Componentes `ActivityCard` e `ActivityTimeline`

**Files:**
- Create: `src/components/Activities/ActivityCard.jsx`
- Create: `src/components/Activities/ActivityTimeline.jsx`

- [ ] **Step 1: Criar `ActivityCard.jsx`**

```jsx
// src/components/Activities/ActivityCard.jsx
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Trash2, AlertTriangle } from 'lucide-react'

const TYPE_COLORS = {
  meeting:  '#7C3AED',
  call:     '#05CD99',
  email:    '#3B82F6',
  whatsapp: '#22C55E',
  note:     '#F59E0B',
  task:     '#EF4444',
}

const TYPE_LABELS = {
  meeting: 'Reunião', call: 'Ligação', email: 'Email',
  whatsapp: 'WhatsApp', note: 'Nota', task: 'Tarefa',
}

const extractText = (body) => {
  if (!body) return null
  try {
    const doc = typeof body === 'string' ? JSON.parse(body) : body
    const texts = []
    const walk = (node) => {
      if (node.type === 'text') texts.push(node.text)
      if (node.content) node.content.forEach(walk)
    }
    walk(doc)
    return texts.join(' ').slice(0, 120) || null
  } catch { return null }
}

const ActivityCard = ({ activity, onToggleStatus, onDelete }) => {
  const isDone = activity.status === 'completed'
  const color = TYPE_COLORS[activity.type] || '#94A3B8'
  const preview = extractText(activity.body)

  return (
    <motion.div
      className={`activity-card ${isDone ? 'activity-done' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="activity-card-header">
        <span className="activity-type-badge" style={{ background: `${color}20`, color }}>
          {TYPE_LABELS[activity.type] || activity.type}
        </span>
        <span className="activity-date">
          {activity.scheduled_at
            ? new Date(activity.scheduled_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })
            : new Date(activity.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short'
              })
          }
        </span>
        {activity.created_by && (
          <span className="activity-author">· {activity.created_by}</span>
        )}
      </div>

      <div className="activity-card-body">
        <h4 className={isDone ? 'line-through' : ''}>{activity.title}</h4>
        {preview && <p className="activity-preview">{preview}</p>}
      </div>

      {Array.isArray(activity.related_to) && activity.related_to.length > 0 && (
        <div className="activity-chips">
          {activity.related_to.map((r, i) => (
            <span key={i} className="activity-chip">
              {r.label}
              {!r.id && <AlertTriangle size={10} style={{ marginLeft: 4, color: 'var(--warning)' }} />}
            </span>
          ))}
        </div>
      )}

      <div className="activity-card-actions">
        <button
          className="icon-btn sm"
          onClick={() => onToggleStatus(activity.id, isDone ? 'pending' : 'completed')}
          title={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          {isDone ? <CheckCircle size={15} style={{ color: 'var(--success)' }} /> : <Circle size={15} />}
        </button>
        <button className="icon-btn sm danger" onClick={() => onDelete(activity.id)} title="Excluir">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

export default ActivityCard
```

- [ ] **Step 2: Criar `ActivityTimeline.jsx`**

```jsx
// src/components/Activities/ActivityTimeline.jsx
import { AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import ActivityCard from './ActivityCard'

const ActivityTimeline = ({ activities, onToggleStatus, onDelete, emptyMessage }) => {
  if (!activities || activities.length === 0) {
    return (
      <div className="timeline-empty">
        <Activity size={28} />
        <p>{emptyMessage || 'Nenhuma atividade registrada ainda.'}</p>
      </div>
    )
  }

  return (
    <div className="activity-timeline">
      <div className="timeline-line" />
      <div className="timeline-items">
        <AnimatePresence>
          {activities.map(activity => (
            <div key={activity.id} className="timeline-item">
              <div className="timeline-dot" />
              <ActivityCard
                activity={activity}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ActivityTimeline
```

- [ ] **Step 3: Adicionar estilos ao `src/index.css`**

```css
/* ─── ActivityTimeline & ActivityCard ─── */
.activity-timeline {
  position: relative;
  padding-left: 24px;
}

.timeline-line {
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--timeline-line);
  border-radius: 1px;
}

.timeline-items { display: flex; flex-direction: column; gap: 12px; }

.timeline-item { position: relative; }

.timeline-dot {
  position: absolute;
  left: -20px;
  top: 14px;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--primary);
  border: 2px solid var(--bg-main);
  box-shadow: 0 0 0 2px var(--primary);
}

.activity-card {
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow .15s ease;
}
.activity-card:hover { box-shadow: var(--shadow-hover); }
.activity-card.activity-done { opacity: .6; }

.activity-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.activity-type-badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
}

.activity-date { font-size: 11px; color: var(--text-secondary); }
.activity-author { font-size: 11px; color: var(--text-secondary); }

.activity-card-body h4 {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 4px;
}
.activity-card-body h4.line-through { text-decoration: line-through; }

.activity-preview {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.activity-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.activity-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--primary-light);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
}

.activity-card-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 8px;
}

.timeline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--text-secondary);
  text-align: center;
}
.timeline-empty p { font-size: 13px; margin: 0; }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Activities/ActivityCard.jsx src/components/Activities/ActivityTimeline.jsx src/index.css
git commit -m "feat: ActivityCard e ActivityTimeline com suporte à skin system"
```

---

## Chunk 3: Forms e Modais

---

### Task 10: Componente `ActivityForm` (com Tiptap lazy loaded)

**Files:**
- Create: `src/components/Activities/ActivityForm.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Activities/ActivityForm.jsx
import { useState, useEffect, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar } from 'lucide-react'
import RelationChips from './RelationChips'

// Lazy load do Tiptap — só carrega quando o form é aberto
const TiptapEditor = lazy(() =>
  import('@tiptap/react').then(({ useEditor, EditorContent }) => {
    // Wrapper como componente default exportável
    const Editor = ({ content, onChange }) => {
      const [StarterKit, setStarterKit] = useState(null)
      useEffect(() => {
        import('@tiptap/starter-kit').then(m => setStarterKit(m.default))
      }, [])
      const editor = useEditor({
        extensions: StarterKit ? [StarterKit] : [],
        content: content || '',
        onUpdate: ({ editor }) => onChange(editor.getJSON()),
      }, [StarterKit])
      if (!StarterKit || !editor) return <div className="editor-loading">Carregando editor...</div>
      return (
        <div className="tiptap-wrapper">
          <div className="tiptap-toolbar">
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}>B</button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}>I</button>
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''}>•</button>
          </div>
          <EditorContent editor={editor} className="tiptap-content" />
        </div>
      )
    }
    return { default: Editor }
  })
)

const ACTIVITY_TYPES = [
  { value: 'meeting',  label: 'Reunião' },
  { value: 'call',     label: 'Ligação' },
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note',     label: 'Nota' },
  { value: 'task',     label: 'Tarefa' },
]

const ActivityForm = ({ activity, onSave, onClose, clients, tasks, team }) => {
  const [form, setForm] = useState({
    title: '',
    type: 'meeting',
    body: null,
    status: 'pending',
    scheduled_at: '',
    created_by: '',
    related_to: [],
    ...(activity || {}),
    scheduled_at: activity?.scheduled_at
      ? new Date(activity.scheduled_at).toISOString().slice(0, 16)
      : '',
  })

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    })
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal activity-modal"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <h2>{activity ? 'Editar Atividade' : 'Nova Atividade'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => change('title', e.target.value)}
              placeholder="Assunto da atividade"
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <div className="type-selector">
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`type-btn ${form.type === t.value ? 'active' : ''}`}
                    onClick={() => change('type', t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><Calendar size={13} style={{ marginRight: 4 }} />Data / Hora (lembrete)</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => change('scheduled_at', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Criado por</label>
              <select value={form.created_by} onChange={e => change('created_by', e.target.value)}>
                <option value="">Selecione...</option>
                {team.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Vínculos</label>
            <RelationChips
              value={form.related_to}
              onChange={v => change('related_to', v)}
              clients={clients}
              tasks={tasks}
              team={team}
            />
          </div>

          <div className="form-group">
            <label>Notas</label>
            <Suspense fallback={<div className="editor-loading">Carregando editor...</div>}>
              <TiptapEditor
                content={form.body}
                onChange={v => change('body', v)}
              />
            </Suspense>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">
              {activity ? 'Salvar' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ActivityForm
```

- [ ] **Step 2: Adicionar estilos ao `src/index.css`**

```css
/* ─── ActivityForm / Tiptap ─── */
.activity-modal { max-width: 620px; width: 100%; }

.type-selector { display: flex; gap: 6px; flex-wrap: wrap; }

.type-btn {
  padding: 5px 12px;
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-full);
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all .15s;
}
.type-btn:hover { border-color: var(--primary); color: var(--text-main); }
.type-btn.active {
  background: var(--primary);
  color: var(--bg-main);
  border-color: var(--primary);
}

.tiptap-wrapper {
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--card-bg);
}

.tiptap-toolbar {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: var(--border-width) solid var(--border-color);
  background: var(--bg-main);
}

.tiptap-toolbar button {
  padding: 3px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
}
.tiptap-toolbar button:hover { background: var(--primary-light); color: var(--text-main); }
.tiptap-toolbar button.active { background: var(--primary-light); color: var(--primary); }

.tiptap-content {
  padding: 12px;
  min-height: 100px;
  font-size: 13px;
  color: var(--text-main);
  outline: none;
}
.tiptap-content p { margin-bottom: 8px; }
.tiptap-content ul { padding-left: 20px; }
.tiptap-content:focus-within { outline: none; }

.editor-loading {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 3: Verificar no browser**

O app ainda não usa `ActivityForm` diretamente. Confirme que não há erros de import no console.

- [ ] **Step 4: Commit**

```bash
git add src/components/Activities/ActivityForm.jsx src/index.css
git commit -m "feat: ActivityForm com Tiptap lazy loaded e RelationChips integrado"
```

---

### Task 11: Componente `RecordSidebar`

**Files:**
- Create: `src/components/shared/RecordSidebar.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/shared/RecordSidebar.jsx
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const RecordSidebar = ({ isOpen, onClose, title, subtitle, children }) => {
  // Fecha com Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="sidebar-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          {/* Painel */}
          <motion.aside
            className="record-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="record-sidebar-header">
              <div>
                <h2 className="record-sidebar-title">{title}</h2>
                {subtitle && <span className="record-sidebar-subtitle">{subtitle}</span>}
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="record-sidebar-body">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default RecordSidebar
```

- [ ] **Step 2: Adicionar estilos ao `src/index.css`**

```css
/* ─── RecordSidebar ─── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: var(--sidebar-overlay);
  z-index: 200;
}

.record-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  max-width: 95vw;
  background: var(--card-bg);
  border-left: var(--border-width) solid var(--border-color);
  z-index: 201;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 768px) {
  .record-sidebar { width: 100vw; }
}

.record-sidebar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
}

.record-sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.record-sidebar-subtitle {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.record-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/RecordSidebar.jsx src/index.css
git commit -m "feat: componente RecordSidebar (painel deslizante lateral)"
```

---

## Chunk 4: Global Patterns e Views

---

### Task 12: Componente `CommandPalette`

**Files:**
- Create: `src/components/shared/CommandPalette.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/shared/CommandPalette.jsx
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Building2, CheckSquare, Activity, Plus } from 'lucide-react'

const TYPE_ICONS = {
  client:   Building2,
  task:     CheckSquare,
  activity: Activity,
}

const TYPE_LABELS = {
  client: 'Cliente', task: 'Tarefa', activity: 'Atividade',
}

const CommandPalette = ({ isOpen, query, setQuery, results, onClose, onSelect, onCreateActivity }) => {
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  const items = results()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="palette-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="command-palette"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.15 }}
          >
            <div className="palette-search">
              <Search size={16} className="palette-search-icon" />
              <input
                ref={inputRef}
                type="text"
                className="palette-input"
                placeholder="Buscar cliente, tarefa ou atividade..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <span className="palette-esc">ESC</span>
            </div>

            {query.trim() ? (
              <div className="palette-results">
                {items.length === 0 ? (
                  <div className="palette-empty">
                    <p>Nenhum resultado para "{query}"</p>
                    <button className="palette-action-btn" onClick={() => { onCreateActivity(); onClose() }}>
                      <Plus size={14} /> Criar nova atividade "{query}"
                    </button>
                  </div>
                ) : (
                  items.map(item => {
                    const Icon = TYPE_ICONS[item.type] || Activity
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        className="palette-item"
                        onClick={() => { onSelect(item); onClose() }}
                      >
                        <Icon size={15} className="palette-item-icon" />
                        <span className="palette-item-label">{item.label}</span>
                        {item.sub && <span className="palette-item-sub">{item.sub}</span>}
                        <span className="palette-item-type">{TYPE_LABELS[item.type]}</span>
                      </button>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="palette-hint">
                <span>Digite para buscar • </span>
                <button className="palette-action-btn-inline" onClick={() => { onCreateActivity(); onClose() }}>
                  <Plus size={12} /> Nova atividade
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
```

- [ ] **Step 2: Adicionar estilos ao `src/index.css`**

```css
/* ─── CommandPalette ─── */
.palette-overlay {
  position: fixed;
  inset: 0;
  background: var(--sidebar-overlay);
  z-index: 300;
}

.command-palette {
  position: fixed;
  top: 15vh;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  max-width: 95vw;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 301;
  overflow: hidden;
}

.palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: var(--border-width) solid var(--border-color);
}

.palette-search-icon { color: var(--text-secondary); flex-shrink: 0; }

.palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--text-main);
}
.palette-input::placeholder { color: var(--text-secondary); }

.palette-esc {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px 5px;
}

.palette-results { padding: 6px 0; max-height: 320px; overflow-y: auto; }

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-sans);
}
.palette-item:hover { background: var(--primary-light); }

.palette-item-icon { color: var(--text-secondary); flex-shrink: 0; }
.palette-item-label { font-size: 13px; color: var(--text-main); flex: 1; }
.palette-item-sub { font-size: 11px; color: var(--text-secondary); }
.palette-item-type {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-secondary);
}

.palette-empty {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.palette-empty p { font-size: 13px; color: var(--text-secondary); margin: 0; }

.palette-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--radius-md);
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-main);
  font-family: var(--font-sans);
}
.palette-action-btn:hover { background: var(--primary-light); }

.palette-hint {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.palette-action-btn-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--primary);
  font-size: 12px;
  font-family: var(--font-sans);
  padding: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/CommandPalette.jsx src/index.css
git commit -m "feat: componente CommandPalette com busca em memória e atalho Ctrl+K"
```

---

### Task 13: View principal `ActivitiesView`

**Files:**
- Create: `src/components/Activities/ActivitiesView.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
// src/components/Activities/ActivitiesView.jsx
import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Filter } from 'lucide-react'
import ActivityTimeline from './ActivityTimeline'
import ActivityForm from './ActivityForm'

const TYPE_FILTER_OPTIONS = [
  { value: null, label: 'Todos' },
  { value: 'meeting', label: 'Reuniões' },
  { value: 'call', label: 'Ligações' },
  { value: 'email', label: 'Emails' },
  { value: 'note', label: 'Notas' },
  { value: 'task', label: 'Tarefas' },
]

const ActivitiesView = ({ activities, onAdd, onUpdate, onDelete, clients, tasks, team, searchQuery }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'completed'

  const filtered = activities.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false
    if (statusFilter === 'pending' && a.status !== 'pending') return false
    if (statusFilter === 'completed' && a.status !== 'completed') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (a.title || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleSave = async (data) => {
    if (editingActivity) {
      await onUpdate(editingActivity.id, data)
    } else {
      await onAdd(data)
    }
    setShowForm(false)
    setEditingActivity(null)
  }

  const handleToggleStatus = (id, status) => {
    onUpdate(id, { status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : { completed_at: null }) })
  }

  return (
    <div className="activities-view">
      <div className="section-header-row">
        <h3 className="section-title">Atividades</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="action-btn"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', cursor: 'pointer' }}
          >
            <option value="all">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídas</option>
          </select>
          <button className="add-member-btn" onClick={() => { setEditingActivity(null); setShowForm(true) }}>
            <Plus size={16} /> Nova Atividade
          </button>
        </div>
      </div>

      <div className="type-filter-bar">
        {TYPE_FILTER_OPTIONS.map(opt => (
          <button
            key={String(opt.value)}
            className={`tab-btn ${typeFilter === opt.value ? 'active' : ''}`}
            onClick={() => setTypeFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="activities-content">
        {filtered.length === 0 && !activities.length ? (
          <div className="empty-state">
            <h2>Nenhuma atividade ainda</h2>
            <p>Registre reuniões, ligações, notas e emails vinculados a clientes e tarefas.</p>
          </div>
        ) : (
          <ActivityTimeline
            activities={filtered}
            onToggleStatus={handleToggleStatus}
            onDelete={onDelete}
            emptyMessage="Nenhuma atividade para os filtros selecionados."
          />
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <ActivityForm
            activity={editingActivity}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingActivity(null) }}
            clients={clients}
            tasks={tasks}
            team={team}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ActivitiesView
```

- [ ] **Step 2: Adicionar estilos ao `src/index.css`**

```css
/* ─── ActivitiesView ─── */
.activities-view { display: flex; flex-direction: column; gap: 16px; height: 100%; }

.type-filter-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.activities-content { flex: 1; overflow-y: auto; }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Activities/ActivitiesView.jsx src/index.css
git commit -m "feat: ActivitiesView com filtros de tipo e status"
```

---

## Chunk 5: Integração Final

---

### Task 14: Atualizar `App.jsx` — conectar tudo

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Adicionar imports no topo de `App.jsx`**

Após os imports existentes, adicionar:

```js
import ActivitiesView from './components/Activities/ActivitiesView'
import CommandPalette from './components/shared/CommandPalette'
import ReminderToast from './components/shared/ReminderToast'
import { useActivities } from './hooks/useActivities'
import { useCommandPalette } from './hooks/useCommandPalette'
import { Activity } from 'lucide-react'
```

> **Nota sobre ESC no CommandPalette:** O handler de ESC já está implementado no hook `useCommandPalette` (Task 5). Ao pressionar ESC, o hook chama `setIsOpen(false)` e `setQuery('')` automaticamente — não é necessário adicionar listener separado no componente.

- [ ] **Step 2: Adicionar o hook `useActivities` dentro de `function App()`**

Logo após as declarações de state existentes (linha ~34):

```js
const { activities, addActivity, updateActivity, deleteActivity } = useActivities()
```

- [ ] **Step 3: Adicionar o hook `useCommandPalette` dentro de `function App()`**

Logo após o hook de activities:

```js
const commandPalette = useCommandPalette(tasks, clients, activities)
```

- [ ] **Step 4: Adicionar case `'atividades'` no `renderContent()`**

Dentro do `switch(activeTab)`, antes do `default`:

```js
case 'atividades':
  return (
    <ActivitiesView
      activities={activities}
      onAdd={addActivity}
      onUpdate={updateActivity}
      onDelete={deleteActivity}
      clients={clients}
      tasks={tasks}
      team={team}
      searchQuery={searchQuery}
    />
  )
```

- [ ] **Step 5: Adicionar `'atividades'` no `getPageTitle()`**

```js
case 'atividades': return 'Atividades'
```

- [ ] **Step 6: Adicionar `<CommandPalette>` e `<ReminderToast>` no JSX do return**

Logo antes de `<Sidebar>` dentro do `<div className="app-container">`:

```jsx
<CommandPalette
  isOpen={commandPalette.isOpen}
  query={commandPalette.query}
  setQuery={commandPalette.setQuery}
  results={commandPalette.results}
  onClose={commandPalette.close}
  onSelect={(item) => {
    if (item.type === 'client') handleTabChange('clientes')
    if (item.type === 'task') handleTabChange('tarefas')
    if (item.type === 'activity') handleTabChange('atividades')
  }}
  onCreateActivity={() => handleTabChange('atividades')}
/>
<ReminderToast activities={activities} />
```

- [ ] **Step 7: Verificar no browser**

Abra http://localhost:5173:
- A tab "Atividades" ainda não está no sidebar — isso é normal por ora
- Nenhum erro de console
- Pressione `Ctrl+K` (ou `⌘K` no Mac) — o CommandPalette deve abrir
- Digite algo no CommandPalette — resultados de clientes e tarefas existentes devem aparecer
- Pressione ESC — o painel deve fechar

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: integra useActivities, CommandPalette e ReminderToast no App"
```

---

### Task 15: Atualizar `Sidebar.jsx`

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Adicionar item "Atividades" no array `menuItems`**

Localizar o array `menuItems` e alterar o import e o array:

```js
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity } from 'lucide-react'

const menuItems = [
  { id: 'dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'tarefas',     label: 'Minhas Tarefas',  icon: CheckSquare },
  { id: 'atividades',  label: 'Atividades',      icon: Activity },
  { id: 'time',        label: 'Time',            icon: Users },
  { id: 'clientes',    label: 'Clientes',        icon: UserCircle },
]
```

- [ ] **Step 2: Verificar no browser**

Abra http://localhost:5173 — "Atividades" aparece no sidebar. Clicar na tab abre o `ActivitiesView` vazio.

- [ ] **Step 3: Criar uma atividade de teste**

Clique em "Nova Atividade", preencha título "Teste", tipo "Reunião", salve. Confirme que aparece na timeline.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: adiciona tab Atividades ao sidebar"
```

---

### Task 16: Refatorar `ClientProfileModal` para usar `RecordSidebar`

**Files:**
- Modify: `src/components/Clients/ClientesView.jsx`
- Modify: `src/components/Clients/ClientProfileModal.jsx`

- [ ] **Step 1: Alterar `ClientesView.jsx` — substituir `ClientProfileModal` por `RecordSidebar`**

Adicionar import:
```js
import RecordSidebar from '../shared/RecordSidebar'
import ActivityTimeline from '../Activities/ActivityTimeline'
```

Atualizar a assinatura do componente para aceitar `activities`:

```jsx
const ClientesView = ({ clients, tasks, activities = [], onRefresh, searchQuery }) => {
```

**Também atualizar o call-site em `App.jsx`** — localizar `case 'clientes':` no `renderContent()` e passar a nova prop:

```jsx
case 'clientes':
  return <ClientesView clients={clients} tasks={tasks} activities={activities} onRefresh={fetchClients} searchQuery={searchQuery} />
```

> Sem esta linha, `activities` chega sempre como `[]` e a timeline do RecordSidebar fica vazia.

Localizar o `AnimatePresence` que renderiza `ClientProfileModal` e substituir por:

```jsx
<RecordSidebar
  isOpen={!!viewingClient}
  onClose={() => setViewingClient(null)}
  title={viewingClient?.name || ''}
  subtitle={`${viewingClient?.industry || ''} · ${viewingClient?.status || ''}`}
>
  {viewingClient && (
    <ClientProfileModal
      client={viewingClient}
      clientTasks={(tasks || []).filter(t => t.client_id === viewingClient.id)}
      clientActivities={(activities || []).filter(a =>
        Array.isArray(a.related_to) &&
        a.related_to.some(r => r.type === 'client' && r.id === String(viewingClient.id))
      )}
      onEdit={(client) => { setEditingClient(client); setShowEditModal(true) }}
    />
  )}
</RecordSidebar>
```

- [ ] **Step 2: Substituir `ClientProfileModal.jsx` pelo código abaixo (remove o wrapper de modal, mantém todo o conteúdo interno)**

```jsx
import { useState, useEffect } from 'react'
import { Building2, Phone, Mail, Plus, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ActivityTimeline from '../Activities/ActivityTimeline'

const ClientProfileModal = ({ client, clientTasks, clientActivities = [], onEdit }) => {
  const [logs, setLogs] = useState([])
  const [newLog, setNewLog] = useState({ type: 'Ligação', notes: '' })
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    if (client) fetchLogs()
  }, [client])

  const fetchLogs = async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('interaction_logs')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    if (!error) setLogs(data || [])
    setLoadingLogs(false)
  }

  const handleAddLog = async (e) => {
    e.preventDefault()
    if (!newLog.notes.trim()) return
    const { data, error } = await supabase
      .from('interaction_logs')
      .insert([{ client_id: client.id, type: newLog.type, notes: newLog.notes }])
      .select()
    if (!error && data) {
      setLogs([data[0], ...logs])
      setNewLog({ type: 'Ligação', notes: '' })
    }
  }

  return (
    <div className="profile-body">
      <div className="profile-sidebar">
        <div className="info-card">
          <h3>Contato</h3>
          <p><Mail size={14} /> {client.email || 'Sem email'}</p>
          <p><Phone size={14} /> {client.phone || 'Sem telefone'}</p>
        </div>
        <div className="info-card">
          <h3>Negócios</h3>
          <p>Receita Est.: <strong>{client.revenue || 'R$ 0'}</strong></p>
          <p>Projetos Ativos: <strong>{client.projects || 0}</strong></p>
        </div>
        <div className="related-tasks">
          <h3>Tarefas Vinculadas ({clientTasks.length})</h3>
          <div className="task-list-mini">
            {clientTasks.length === 0 ? (
              <p className="empty-text">Nenhuma tarefa associada.</p>
            ) : (
              clientTasks.map(t => (
                <div key={t.id} className="task-mini-card">
                  <span className="task-mini-title">{t.title}</span>
                  <span className={`status-badge ${t.status === 'Concluído' ? 'done' : 'progress'}`}>{t.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <button className="action-btn" onClick={() => onEdit(client)} style={{ marginTop: 12 }}>
          Editar Cliente
        </button>
      </div>

      <div className="interaction-feed">
        {clientActivities.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3>Atividades</h3>
            <ActivityTimeline
              activities={clientActivities}
              onToggleStatus={() => {}}
              onDelete={() => {}}
              emptyMessage="Nenhuma atividade vinculada."
            />
          </div>
        )}

        <h3>Histórico de Interações</h3>
        <form onSubmit={handleAddLog} className="add-log-form">
          <div className="log-type-selector">
            {['Ligação', 'Email', 'Reunião', 'WhatsApp', 'Outro'].map(type => (
              <button
                key={type}
                type="button"
                className={`log-type-btn ${newLog.type === type ? 'active' : ''}`}
                onClick={() => setNewLog({ ...newLog, type })}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="log-input-row">
            <input
              type="text"
              placeholder="Registro de reunião, detalhes da ligação..."
              value={newLog.notes}
              onChange={e => setNewLog({ ...newLog, notes: e.target.value })}
            />
            <button type="submit" className="add-log-btn" disabled={!newLog.notes.trim()}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </form>

        <div className="logs-list">
          {loadingLogs ? (
            <p className="loading-text">Carregando histórico...</p>
          ) : logs.length === 0 ? (
            <div className="empty-log">
              <MessageSquare size={32} />
              <p>Nenhuma interação registrada ainda.</p>
              <span>Mantenha o histórico de contatos atualizado para vender mais.</span>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="log-item">
                <div className="log-header">
                  <span className={`log-type-badge type-${log.type.toLowerCase().replace('ç', 'c').replace('ã', 'a')}`}>
                    {log.type}
                  </span>
                  <span className="log-date">
                    {new Date(log.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="log-notes">{log.notes}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ClientProfileModal
```

- [ ] **Step 3: Verificar no browser**

Clique em um cliente na lista. O painel deve deslizar da direita, a lista de clientes continua visível atrás. Pressione ESC ou clique no overlay para fechar.

- [ ] **Step 4: Commit**

```bash
git add src/components/Clients/ClientesView.jsx src/components/Clients/ClientProfileModal.jsx
git commit -m "feat: ClientesView usa RecordSidebar (painel deslizante) no lugar de modal centrado"
```

---

### Task 17: Adicionar `RelationChips` ao `TaskModal`

**Files:**
- Modify: `src/components/Tasks/TaskModal.jsx`

- [ ] **Step 1: Adicionar import**

```js
import RelationChips from '../Activities/RelationChips'
```

- [ ] **Step 2: Adicionar campo `related_activities` ao `form` state inicial** (substituir o `useState` completo)

```js
const [form, setForm] = useState({
  title: '',
  status: defaultStatus || 'A Fazer',
  priority: 'Média',
  owner: '',
  tags: [],
  progress: 0,
  deal_value: 0,
  client_id: null,
  category: 'Operacional',
  related_activities: [],
})
```

- [ ] **Step 3: Adicionar campo no `useEffect` que popula o form ao editar**

```js
related_activities: task.related_activities || [],
```

- [ ] **Step 4: Adicionar seção de vínculos no JSX, antes das `modal-actions`**

O campo vincula a tarefa a clientes e membros do time (não a outras tarefas recursivamente). `tasks={[]}` é intencional.

```jsx
<div className="form-group">
  <label>Vínculos (Clientes / Time)</label>
  <RelationChips
    value={form.related_activities}
    onChange={v => change('related_activities', v)}
    clients={clients}
    tasks={[]}
    team={team}
  />
</div>
```

- [ ] **Step 5: Verificar no browser**

Abra o TaskModal criando ou editando uma tarefa. O campo "Vínculos" deve aparecer com busca funcional de clientes e membros do time.

- [ ] **Step 6: Commit**

```bash
git add src/components/Tasks/TaskModal.jsx
git commit -m "feat: adiciona RelationChips ao TaskModal para vínculos com atividades"
```

---

### Task 18: Verificação final e ajustes de polish

**Files:**
- Modify: `src/index.css` (ajustes pontuais por skin se necessário)

- [ ] **Step 1: Testar todas as 4 skins**

Para cada skin (`ledger`, `classic`, `dark`, `twenty`):
- Abra http://localhost:5173 e mude o tema
- Confirme que CommandPalette, ActivityTimeline, RecordSidebar e RelationChips ficam visualmente coerentes
- Procure por cores hardcoded que "vazam" de uma skin para outra

- [ ] **Step 2: Testar fluxo completo de Activities**

1. Criar atividade com tipo "Reunião", data futura (2 min à frente), vínculo com um cliente
2. Confirmar que aparece na timeline do módulo Atividades
3. Aguardar ou simular o lembrete (ajustar a data para alguns segundos no futuro)
4. Confirmar que o ReminderToast aparece e desaparece após 8 segundos
5. Abrir um cliente → RecordSidebar → confirmar que as atividades vinculadas aparecem (quando integrado)
6. Pressionar Ctrl+K → buscar pelo nome da atividade → confirmar resultado

- [ ] **Step 3: Testar responsividade mobile**

Redimensionar browser para < 768px:
- RecordSidebar deve ocupar tela inteira
- CommandPalette deve ficar legível

- [ ] **Step 4: Commit final**

```bash
git add src/index.css
git commit -m "feat: ajustes de polish e validação cross-skin do módulo Activities"
```

---

## Resumo de Arquivos

| Arquivo | Status |
|---|---|
| `src/hooks/useActivities.js` | Novo |
| `src/hooks/useReminders.js` | Novo |
| `src/hooks/useCommandPalette.js` | Novo |
| `src/components/Activities/RelationChips.jsx` | Novo |
| `src/components/Activities/ActivityCard.jsx` | Novo |
| `src/components/Activities/ActivityTimeline.jsx` | Novo |
| `src/components/Activities/ActivityForm.jsx` | Novo |
| `src/components/Activities/ActivitiesView.jsx` | Novo |
| `src/components/shared/RecordSidebar.jsx` | Novo |
| `src/components/shared/CommandPalette.jsx` | Novo |
| `src/components/shared/ReminderToast.jsx` | Novo |
| `src/App.jsx` | Modificado |
| `src/components/Sidebar.jsx` | Modificado |
| `src/components/Clients/ClientesView.jsx` | Modificado |
| `src/components/Clients/ClientProfileModal.jsx` | Modificado |
| `src/components/Tasks/TaskModal.jsx` | Modificado |
| `src/index.css` | Modificado |
| `src/context/ThemeContext.jsx` | Modificado |
| `index.html` | Modificado |
