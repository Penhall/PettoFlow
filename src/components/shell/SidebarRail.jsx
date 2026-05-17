import {
  Activity,
  Archive,
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  LifeBuoy,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { useTenant } from '../../hooks/useTenant.js'

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Leitor',
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
  { id: 'atividades', label: 'Atividades', icon: Activity },
  { id: 'financas', label: 'Finanças', icon: Wallet },
  { id: 'time', label: 'Time', icon: Users },
  { id: 'clientes', label: 'Clientes', icon: UserCircle },
  { id: 'arquivo', label: 'Arquivo', icon: Archive },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'tutoriais', label: 'Tutoriais', icon: LifeBuoy },
  { id: 'settings', label: 'Configurações', icon: Settings },
]

export default function SidebarRail({
  activeTab,
  onChange,
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
}) {
  const { user, isPlatformAdmin } = useAuth()
  const { activeTenant } = useTenant()

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-rail__overlay"
          onClick={onMobileClose}
          aria-label="Fechar navegação"
        />
      ) : null}

      <div
        className={[
          'sidebar-rail',
          collapsed ? 'sidebar-rail--collapsed' : '',
          mobileOpen ? 'sidebar-rail--mobile-open' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="sidebar-rail__brand">
          <div className="sidebar-rail__mark">N</div>
          {!collapsed ? (
            <div className="sidebar-rail__workspace">
              <strong>{activeTenant?.name || 'NexusCRM'}</strong>
              <span>{ROLE_LABELS[activeTenant?.role] || 'Espaço ativo'}</span>
            </div>
          ) : null}
        </div>

        <nav className="sidebar-rail__nav" aria-label="Principal">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-rail__item ${activeTab === id ? 'is-active' : ''}`}
              aria-current={activeTab === id ? 'page' : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
              onClick={() => {
                onChange?.(id)
                onMobileClose?.()
              }}
            >
              <span className="sidebar-rail__icon">
                <Icon size={18} />
              </span>
              {!collapsed ? <span className="sidebar-rail__label">{label}</span> : null}
            </button>
          ))}
          {isPlatformAdmin && (
            <>
              <div className="sidebar-rail__admin-divider" />
              {!collapsed ? (
                <div className="sidebar-rail__section-label">
                  Gestão SaaS
                </div>
              ) : null}
              {[
                { id: 'admin-dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'admin-tenants', label: 'Clientes', icon: Building2 },
                { id: 'admin-audit', label: 'Auditoria', icon: ScrollText },
                { id: 'admin-plans', label: 'Planos', icon: Package },
                { id: 'admin-diagnostics', label: 'Diagnósticos', icon: BarChart3 },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`sidebar-rail__item ${activeTab === id ? 'is-active' : ''}`}
                  aria-current={activeTab === id ? 'page' : undefined}
                  aria-label={label}
                  title={collapsed ? label : undefined}
                  onClick={() => {
                    onChange?.(id)
                    onMobileClose?.()
                  }}
                >
                  <span className="sidebar-rail__icon">
                    <Icon size={18} />
                  </span>
                  {!collapsed ? <span className="sidebar-rail__label">{label}</span> : null}
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-rail__footer">
          <div className="sidebar-rail__avatar">
            {(user?.email?.[0] || 'N').toUpperCase()}
          </div>
          {!collapsed ? (
            <div className="sidebar-rail__identity">
              <strong>{user?.email || 'Usuário NexusCRM'}</strong>
              <span>Conta ativa</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
