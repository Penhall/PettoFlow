# Fase 4: Notificações — Implementação

Implemente o sistema de notificações do NexusCRM. Workflow: Codex implementa (builder), Claude Code revisa depois.

Diretório de trabalho: /root/PettoFlow

## Contexto do Projeto

- React 18 + Vite (JavaScript, não TypeScript)
- Edge Functions em Deno (TypeScript)
- CSS puro, classes com naming BEM-like
- PT-BR em toda interface
- Bot Telegram já implementado com `_shared/telegram.ts` (sendMessage, registerWebhook, deleteWebhook)
- Atividades têm `scheduled_at` TIMESTAMPTZ e `status TEXT`
- ReminderToast atual usa setTimeout client-side (substituir parcialmente)

## Arquivos para criar

### 1. supabase/migrations/20260513000000_notifications.sql

Migration SQL seguindo o padrão dos arquivos existentes em supabase/migrations/.

Deve:
- Criar TABLE public.notifications (id UUID PK, tenant_id UUID FK tenants, user_id UUID FK auth.users, type TEXT CHECK, title TEXT NOT NULL, body TEXT, resource_type TEXT, resource_id TEXT, read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now())
- Adicionar coluna notified_at TIMESTAMPTZ em activities (opcional, para evitar re-notificação)
- Habilitar RLS
- Criar policy: service_role full access
- Criar policy para user autenticado ler suas próprias notificações (user_id = auth.uid()) e marcar como lida
- Índices: (user_id, read, created_at DESC), (tenant_id)

### 2. supabase/functions/notification-worker/index.ts

Edge Function em Deno que:
- Método GET ou POST (chamável manualmente)
- Usa service role client (`getServiceRoleClient` do `../_shared/supabase.ts`)
- Busca atividades com scheduled_at BETWEEN now() AND now() + interval '15 minutes' AND status = 'pending'
- Para cada atividade, encontra o tenant_id e os membros do tenant (via memberships)
- Cria uma row em notifications para cada membro, com type='activity_reminder', title da atividade, resource_type='activity', resource_id=id da atividade
- Atualiza notified_at na atividade para evitar duplicata
- Se bot_configs existir (single row), descriptografa o token e envia push via Telegram sendMessage para cada chat_id na allowed_telegram_ids
- Log com console.log

Import patterns (copiar dos arquivos existentes):
```typescript
import { getServiceRoleClient } from '../_shared/supabase.ts'
```

### 3. src/hooks/useNotifications.js

Hook React:
```javascript
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
```

- Estado: notifications[], unreadCount, loading
- Polling a cada 15 segundos buscando de `notifications` via user_supabase_client (ou supabase anon key + auth token)
- Select: id, type, title, body, resource_type, resource_id, read, created_at — ordenado por created_at DESC, limit 50
- Filter: user_id = auth.uid(), mas via RLS (não precisa filter explícito)
- Exporta: notifications, unreadCount, loading, markAsRead(id), markAllAsRead(), refresh()
- Cleanup do intervalo no useEffect return
- Usa supabase channel (Realtime) como fallback: se disponível, escuta INSERT em notifications com user_id filter

### 4. src/components/shared/NotificationBell.jsx

Componente React que:
- Usa o hook useNotifications
- Ícone de sino (Bell ou BellRing do lucide-react, importar de 'lucide-react')
- Badge circular vermelho com unreadCount (se > 0)
- Ao clicar: abre dropdown com lista das últimas 10 notificações não lidas
- Cada notificação no dropdown: título, descrição curta, "X min atrás" (formato relativo, não precisa de lib — calcula com Date.now())
- Botão "Marcar todas como lidas" no header do dropdown
- Click em notificação: chama markAsRead(id)
- Fecha dropdown ao clicar fora (useEffect com event listener)
- Traduz type para label PT-BR: activity_reminder = "Lembrete", task_assigned = "Atribuída", etc.
- Usa className: notification-bell, notification-bell__badge, notification-bell__dropdown, notification-bell__item, notification-bell__empty

### 5. src/components/shared/ReminderToast.jsx (MODIFICAR)

Mudanças no arquivo existente:
- Adicionar polling também para notificações (integração com useNotifications)
- Manter a UI existente de toasts com AnimatePresence
- Quando uma nova notificação chega (tipo activity_reminder), exibir como toast
- Manter compatibilidade com o uso existente (prop `activities` para o antigo useReminders como fallback)

## Arquivos para modificar

### 6. src/components/shell/Topbar.jsx

Adicionar NotificationBell entre ThemeSwitcher e o bloco isPlatformAdmin:
```jsx
import NotificationBell from '../shared/NotificationBell.jsx'

// ...depois de <ThemeSwitcher /> e antes de {isPlatformAdmin ? ...}:
<NotificationBell />
```

Não quebre nenhuma prop existente.

## Regras de estilo

- Todos os novos componentes React em JSX (não TSX)
- 2 espaços de indentação
- PT-BR em labels, tooltips, placeholders, erros
- Nomes de classe: BEM-like (notification-bell, notification-bell__badge, etc.)
- CSS inline com objetos style ou className (seguir o padrão do projeto)
- Usar `var(--bg-secondary)`, `var(--text-secondary)`, `var(--border-color)`, `var(--primary)` para cores
- Não adicionar dependências npm novas
