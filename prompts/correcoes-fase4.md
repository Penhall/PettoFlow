# Correções da Revisão — Fase 4 Notificações

Diretório: /root/PettoFlow

Aplique as correções abaixo nos arquivos do sistema de notificações. Cada correção referencia o #ID da revisão do Claude Code.

## Arquivos para modificar

### 1. src/hooks/useNotifications.js (Correções #1, #6)

#1: Remover o polling interval e o Realtime channel deste hook. O hook deve APENAS buscar dados e expor funções, sem side effects de polling/subscribe. O polling será feito em nível superior (App.jsx).

#6: Remover userIdRef (dead code — nunca lido em lugar nenhum).

Mudanças:
- Remover `POLL_INTERVAL_MS` 
- Remover `const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS)` e seu cleanup
- Remover o useEffect do Realtime channel (`.channel(...).on('postgres_changes'...)`)
- Chamar `refresh()` apenas no mount (um único fetch inicial)
- Remover `userIdRef` completamente
- Manter: refresh, markAsRead, markAllAsRead, notifications, unreadCount, loading

### 2. src/components/shared/NotificationBell.jsx (Correções #1, #9, #10, #11, #12)

#1: Receber `notifications`, `unreadCount`, `loading`, `markAsRead`, `markAllAsRead`, `refresh` como PROPS em vez de chamar useNotifications() internamente.

```jsx
export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  loading = false,
  markAsRead = () => {},
  markAllAsRead = () => {},
  refresh = () => {},
})
```

#9: Ao clicar em uma notificação, fechar o dropdown: `onClick={() => { markAsRead(notification.id); setOpen(false) }}`

#10: Adicionar handler de tecla Escape no mesmo useEffect do pointerdown:
```jsx
const handleKeyDown = (event) => {
  if (event.key === 'Escape') setOpen(false)
}
document.addEventListener('keydown', handleKeyDown)
return () => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeyDown)
}
```

#11: Na badge: mostrar contagem mas limitar badge a "99+". No dropdown: remover `.slice(0, 10)` para mostrar todas. Se houver mais que 10, adicionar um item final "e mais X não lidas".

#12: Adicionar `aria-haspopup="dialog"` no botão trigger.

### 3. src/components/shared/ReminderToast.jsx (Correção #1)

#1: Receber `notifications` e `notificationsLoading` como props em vez de chamar useNotifications() internamente.

```jsx
const ReminderToast = ({ activities, notifications = [], notificationsLoading = false }) => {
```

### 4. src/App.jsx (Correção #1 — integrar useNotifications no nível superior)

Adicionar no início do componente App (após os outros hooks):
```javascript
// ReminderToast notifications
const [notifState, setNotifState] = useState({ notifications: [], unreadCount: 0, loading: false })
const notifRefreshRef = useRef(null)
```

Importar `useNotifications` de `'./hooks/useNotifications.js'`

E no JSX, passar para NotificationBell e ReminderToast:
```jsx
<NotificationBell
  notifications={notifState.notifications}
  unreadCount={notifState.unreadCount}
  loading={notifState.loading}
  markAsRead={notifState.markAsRead}
  markAllAsRead={notifState.markAllAsRead}
  refresh={notifState.refresh}
/>
{showReminderToast && (
  <ReminderToast activities={activities} notifications={notifState.notifications} notificationsLoading={notifState.loading} />
)}
```

Precisa instanciar useNotifications no App:
```javascript
const {
  notifications: notifNotifications,
  unreadCount: notifUnreadCount,
  loading: notifLoading,
  markAsRead: notifMarkAsRead,
  markAllAsRead: notifMarkAllAsRead,
  refresh: notifRefresh,
} = useNotifications()
```

E mapear para o estado/objeto passado aos componentes.

### 5. supabase/functions/notification-worker/index.ts (Correções #2, #4, #7, #8)

#8: Adicionar autenticação no início do handler Deno.serve:
```typescript
const authHeader = req.headers.get('authorization') || ''
const cronSecret = Deno.env.get('CRON_SECRET') || ''
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return json(req, { error: 'Unauthorized' }, 401)
}
```

#2: Mover busca de bot_config para dentro do loop (por tenant_id da atividade):
```typescript
// Dentro do loop, para cada tenant_id único:
let botTokenForTenant = ''
const { data: tenantBotConfig } = await sb
  .from('bot_configs')
  .select('telegram_bot_token, allowed_telegram_ids, is_active')
  .eq('tenant_id', activity.tenant_id)
  .maybeSingle()
```

#7: Substituir N+1 queries de memberships por batch query única:
```typescript
// Antes do loop, coletar todos os tenant_ids únicos
const uniqueTenantIds = [...new Set((activities ?? []).map(a => a.tenant_id).filter(Boolean))]
const { data: allMemberships } = await sb
  .from('memberships')
  .select('user_id, tenant_id')
  .in('tenant_id', uniqueTenantIds)
  .eq('status', 'active')
// Dentro do loop: filtrar por tenant_id
const membersForActivity = (allMemberships ?? []).filter(m => m.tenant_id === activity.tenant_id)
```

#4: Adicionar unique constraint na notificação + usar ON CONFLICT DO NOTHING:
```typescript
// Na inserção:
const { error: insertError } = await sb
  .from('notifications')
  .upsert(rows, { onConflict: 'user_id,resource_type,resource_id,type', ignoreDuplicates: true })
```

### 6. supabase/migrations/20260513000000_notifications.sql (Correções #4, #5)

#4: Adicionar UNIQUE constraint:
```sql
alter table public.notifications
  add constraint notifications_unique_user_resource
  unique (user_id, resource_type, resource_id, type);
```

#5: Substituir o índice `activities_notified_at_idx` por um que cubra a query do worker:
```sql
-- Remover:
-- create index if not exists activities_notified_at_idx
--   on public.activities (notified_at)
--   where notified_at is not null;

-- Adicionar:
create index if not exists activities_pending_unnotified_scheduled_idx
  on public.activities (scheduled_at)
  where status = 'pending' and notified_at is null;
```

### 7. src/index.css (Correções #3, #13)

#3: Corrigir dropdown CSS:
```css
.notification-bell__dropdown {
  /* remover overflow: hidden */
  display: flex;
  flex-direction: column;
}
.notification-bell__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

#13: Trocar cor hardcoded do badge por variável CSS:
```css
.notification-bell__badge {
  background: var(--color-badge, #dc2626);
}
```

## Regras
- 2 espaços de indentação
- PT-BR em labels
- Manter estilo consistente com o código existente
