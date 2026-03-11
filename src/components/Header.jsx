import { Search, Bell, Download, ChevronRight } from 'lucide-react'

const Header = ({ title, searchQuery, onSearch, onExport }) => {
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
