import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'

const TYPE_LABELS = {
  activity_reminder: 'Lembrete',
  task_assigned: 'Atribuída',
  task_updated: 'Atualizada',
  task_due: 'Prazo',
  mention: 'Menção',
  system: 'Sistema',
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'agora'

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min atrás`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h atrás`

  const days = Math.floor(hours / 24)
  return `${days} d atrás`
}

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  loading = false,
  markAsRead = () => {},
  markAllAsRead = () => {},
  refresh = () => {},
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications],
  )
  const extraUnreadCount = Math.max(0, unreadCount - 10)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const Icon = unreadCount > 0 ? BellRing : Bell

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="topbar-shell__icon notification-bell__trigger"
        onClick={() => {
          if (!open) refresh()
          setOpen((current) => !current)
        }}
        aria-label="Abrir notificações"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon size={16} />
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-bell__dropdown" role="dialog" aria-label="Notificações">
          <div className="notification-bell__header">
            <strong>Notificações</strong>
            <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Marcar todas como lidas
            </button>
          </div>

          {loading ? (
            <div className="notification-bell__empty">Carregando notificações...</div>
          ) : unreadNotifications.length > 0 ? (
            <div className="notification-bell__list">
              {unreadNotifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className="notification-bell__item"
                  onClick={() => {
                    markAsRead(notification.id)
                    setOpen(false)
                  }}
                >
                  <span className="notification-bell__item-meta">
                    {TYPE_LABELS[notification.type] ?? 'Notificação'} • {formatRelativeTime(notification.created_at)}
                  </span>
                  <strong>{notification.title}</strong>
                  {notification.body ? <span>{notification.body}</span> : null}
                </button>
              ))}
              {extraUnreadCount > 0 ? (
                <div className="notification-bell__empty">
                  e mais {extraUnreadCount} não lidas
                </div>
              ) : null}
            </div>
          ) : (
            <div className="notification-bell__empty">Nenhuma notificação não lida.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
