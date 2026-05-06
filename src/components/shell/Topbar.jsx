import { Bell, Menu, Search, Shield } from 'lucide-react'
import TenantSwitcher from '../tenant/TenantSwitcher.jsx'

export default function Topbar({
  searchQuery = '',
  onSearch = () => {},
  onMenuToggle,
  profileMenu = null,
  isPlatformAdmin = false,
  onOpenAdmin = () => { window.location.hash = '/admin' },
  workspaceSelector = null,
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
        <label className="topbar-shell__search" aria-label="Pesquisar">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Pesquisar"
          />
        </label>

        <button type="button" className="topbar-shell__icon" aria-label="Notificações">
          <Bell size={16} />
        </button>

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
