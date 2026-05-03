import { useState } from 'react';
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity, Wallet, Archive, ChevronLeft, ChevronRight, CalendarDays, Settings } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, mobileOpen, onMobileClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'tarefas',    label: 'Minhas Tarefas',  icon: CheckSquare     },
    { id: 'atividades', label: 'Atividades',       icon: Activity        },
    { id: 'financas',   label: 'Finanças',         icon: Wallet          },
    { id: 'time',       label: 'Time',             icon: Users           },
    { id: 'clientes',   label: 'Clientes',         icon: UserCircle      },
    { id: 'arquivo',    label: 'Arquivo',          icon: Archive         },
    { id: 'calendario', label: 'Calendário',       icon: CalendarDays    },
    { id: 'settings',   label: 'Configurações',    icon: Settings        },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    // Fecha o drawer mobile após navegar
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Overlay escuro atrás do drawer — apenas quando aberto no mobile */}
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
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
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
            <div className="avatar">P</div>
            {!isCollapsed && (
              <div className="user-info">
                <span className="user-name">Usuário NexusCRM</span>
                <span className="user-role">Administrador</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
