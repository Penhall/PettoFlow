import { Search, Bell, Download, ChevronRight, Palette } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const Header = ({ title, searchQuery, onSearch, onExport }) => {
  const { theme, setTheme, themes } = useTheme()
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  return (
    <header className="top-header">
      <div className="header-left">
        <div className="breadcrumb">
          <span>Projetos</span>
          <ChevronRight size={14} />
          <span className="current">{title}</span>
        </div>
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="header-right">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Pesquisar tarefas..."
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => onSearch('')}>✕</button>
          )}
        </div>
        
        <div className="dropdown-wrapper" style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setShowThemeMenu(!showThemeMenu)} title="Alternar Tema">
            <Palette size={20} />
          </button>
          {showThemeMenu && (
            <div className="dropdown-menu theme-menu" style={{ right: 0, top: '40px' }} onClick={(e) => e.stopPropagation()}>
              {themes.map(t => (
                <button 
                  key={t.id} 
                  className={theme === t.id ? 'selected' : ''} 
                  onClick={() => { setTheme(t.id); setShowThemeMenu(false); }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn"><Bell size={20} /></button>
        <button className="export-btn" onClick={onExport}>
          <Download size={16} />
          <span>Exportar Dados</span>
        </button>
      </div>
    </header>
  )
}

export default Header
