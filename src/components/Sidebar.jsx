import { LayoutDashboard, CheckSquare, Users, UserCircle } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tarefas', label: 'Minhas Tarefas', icon: CheckSquare },
    { id: 'time', label: 'Time', icon: Users },
    { id: 'clientes', label: 'Clientes', icon: UserCircle },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">PF</div>
        <span className="logo-text">PettoFlow</span>
      </div>
      
      <nav className="nav-menu">
        {menuItems.map((item) => (
          <button 
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">P</div>
          <div className="user-info">
            <span className="user-name">Usuário Petto</span>
            <span className="user-role">Administrador</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
