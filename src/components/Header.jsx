import { Search, Bell, Download, Palette, Menu, LogOut, Shield } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../hooks/useAuth.js'
import TenantSwitcher from './tenant/TenantSwitcher.jsx'

const Header = ({ title, searchQuery = '', onSearch, onExport, onMenuToggle }) => {
  const { theme, setTheme, themes } = useTheme()
  const { user, signOut, isPlatformAdmin } = useAuth()
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  async function handleSignOut() {
    try {
      await signOut()
    } catch (error) {
      console.error('Erro ao encerrar sessao:', error)
      alert('Nao foi possivel sair do NexusCRM agora.')
    }
  }

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="hamburger-btn"
          onClick={onMenuToggle}
          aria-label="Abrir menu de navegacao"
        >
          <Menu size={22} />
        </button>

        {title ? <h1 className="page-title">{title}</h1> : null}
      </div>

      <div className="header-right">
        <TenantSwitcher />

        {typeof onSearch === 'function' ? (
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Pesquisar tarefas..."
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => onSearch('')}>x</button>
            )}
          </div>
        ) : null}

        <div className="dropdown-wrapper" style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setShowThemeMenu(!showThemeMenu)} title="Alternar tema">
            <Palette size={20} />
          </button>
          {showThemeMenu && (
            <div className="dropdown-menu theme-menu" style={{ right: 0, top: '40px' }} onClick={(e) => e.stopPropagation()}>
              {themes.map(t => (
                <button
                  key={t.id}
                  className={theme === t.id ? 'selected' : ''}
                  onClick={() => { setTheme(t.id); setShowThemeMenu(false) }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn"><Bell size={20} /></button>
        {isPlatformAdmin && (
          <button
            className="icon-btn"
            onClick={() => { window.location.hash = '/admin' }}
            title="Abrir painel administrativo"
            aria-label="Abrir painel administrativo"
          >
            <Shield size={18} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {user?.email || 'Usuario autenticado'}
          </span>
          <button className="icon-btn" onClick={handleSignOut} title="Sair do NexusCRM" aria-label="Sair do NexusCRM">
            <LogOut size={18} />
          </button>
        </div>
        {typeof onExport === 'function' ? (
          <button className="export-btn" onClick={onExport}>
            <Download size={16} />
            <span>Exportar dados</span>
          </button>
        ) : null}
      </div>
    </header>
  )
}

export default Header
