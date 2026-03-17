import { useState } from 'react';
import { LayoutDashboard, CheckSquare, Users, UserCircle, Activity, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tarefas', label: 'Minhas Tarefas', icon: CheckSquare },
    { id: 'atividades', label: 'Atividades', icon: Activity },
    { id: 'financas',   label: 'Finanças',   icon: Wallet   },
    { id: 'time',       label: 'Time',        icon: Users    },
    { id: 'clientes', label: 'Clientes', icon: UserCircle },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="logo-container">
        <div className="logo-icon">PF</div>
        {!isCollapsed && <span className="logo-text">PettoFlow</span>}
      </div>
      
      <button 
        className="collapse-btn" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      
      <nav className="nav-menu">
        {menuItems.map((item) => (
          <button 
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
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
              <span className="user-name">Usuário Petto</span>
              <span className="user-role">Administrador</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
