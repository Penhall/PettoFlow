import { useState } from 'react'
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity, Wallet, Archive, ChevronLeft, ChevronRight, CalendarDays, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useTenant } from '../hooks/useTenant.js'

const Sidebar = ({ activeTab, setActiveTab, mobileOpen, onMobileClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { user } = useAuth()
  const { activeTenant } = useTenant()

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tarefas', label: 'Minhas Tarefas', icon: CheckSquare },
    { id: 'atividades', label: 'Atividades', icon: Activity },
    { id: 'financas', label: 'Financas', icon: Wallet },
    { id: 'time', label: 'Time', icon: Users },
    { id: 'clientes', label: 'Clientes', icon: UserCircle },
    { id: 'arquivo', label: 'Arquivo', icon: Archive },
    { id: 'calendario', label: 'Calendario', icon: CalendarDays },
    { id: 'settings', label: 'Configuracoes', icon: Settings },
  ]

  const handleNavClick = (id) => {
    setActiveTab(id)
    if (onMobileClose) onMobileClose()
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <div className="logo-icon">NC</div>
          {!isCollapsed && <span className="logo-text">NexusCRM</span>}
        </div>

        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="nav-menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <item.icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">{(user?.email?.[0] || 'N').toUpperCase()}</div>
            {!isCollapsed && (
              <div className="user-info">
                <span className="user-name">{user?.email || 'Usuario NexusCRM'}</span>
                <span className="user-role">{activeTenant?.role || 'Workspace ativo'}</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
