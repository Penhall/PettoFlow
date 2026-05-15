import { Menu, Search, Shield } from 'lucide-react'
import ThemeSwitcher from './ThemeSwitcher.jsx'
import TenantSwitcher from '../tenant/TenantSwitcher.jsx'
import NotificationBell from '../shared/NotificationBell.jsx'

export default function Topbar({
  searchQuery = '',
  onSearch = () => {},
  onMenuToggle,
  onSearchFocus,
  searchPlaceholder = 'Pesquisar',
  showSearch = true,
  profileMenu = null,
  isPlatformAdmin = false,
  onOpenAdmin = () => { window.location.hash = '/admin' },
  workspaceSelector = null,
  notifications = [],
  unreadCount = 0,
  notificationsLoading = false,
  markAsRead = () => {},
  markAllAsRead = () => {},
  refreshNotifications = () => {},
}) {
  return (
    <div className="topbar-shell">
      <div className="topbar-shell__left">
        <button
          type="button"
          className="topbar-shell__menu"
          onClick={onMenuToggle}
          aria-label="Abrir navegação"
        >
          <Menu size={18} />
        </button>

        {workspaceSelector || <TenantSwitcher />}
      </div>

      <div className="topbar-shell__right">
        {showSearch ? (
          <label className="topbar-shell__search" aria-label="Pesquisar">
            <Search size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              onFocus={onSearchFocus}
              placeholder={searchPlaceholder}
            />
          </label>
        ) : null}

        <ThemeSwitcher />

        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationsLoading}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          refresh={refreshNotifications}
        />

        {isPlatformAdmin ? (
          <button
            type="button"
            className="topbar-shell__icon"
            onClick={onOpenAdmin}
            aria-label="Abrir painel administrativo"
          >
            <Shield size={16} />
          </button>
        ) : null}

        {profileMenu}
      </div>
    </div>
  )
}
