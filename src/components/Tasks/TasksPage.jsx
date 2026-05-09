import { ArrowUpDown, Filter } from 'lucide-react'
import ContextualHint from '../onboarding/ContextualHint.jsx'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'

const TASK_VIEW_ITEMS = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Lista' },
  { id: 'overview', label: 'Visão geral' },
  { id: 'files', label: 'Arquivos' },
  { id: 'calendar', label: 'Calendário' },
]

function DropdownAction({
  label,
  icon: Icon,
  active = false,
  open = false,
  onToggle,
  children,
}) {
  return (
    <div className="dropdown-wrapper" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`page-action-bar__button ${active ? 'active-filter' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {Icon ? <Icon size={16} /> : null}
        <span>{label}</span>
      </button>
      {open ? <div className="dropdown-menu">{children}</div> : null}
    </div>
  )
}

export default function TasksPage({
  viewType,
  setViewType,
  searchQuery,
  onSearch,
  sortBy,
  setSortBy,
  filterTag,
  setFilterTag,
  allTags,
  showSortMenu,
  setShowSortMenu,
  showFilterMenu,
  setShowFilterMenu,
  onCreateTask,
  taskCount,
  content,
  emptyState = null,
  contextualHint = null,
}) {
  const shouldRenderEmptyState = Boolean(emptyState && taskCount === 0 && viewType !== 'calendar')

  return (
    <div className="tasks-page">
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        subtitle="Gerencie pipeline, prioridades e execução diária com alta densidade operacional."
      />

      <PageTabs
        items={TASK_VIEW_ITEMS}
        activeId={viewType}
        onChange={setViewType}
        ariaLabel="Views de tarefas"
      />

      <PageActionBar
        searchValue={searchQuery}
        onSearch={onSearch}
        primaryAction={{ label: 'Nova tarefa', onClick: onCreateTask }}
        meta={`${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'}`}
      >
        <DropdownAction
          label={sortBy ? 'Ordenação ativa' : 'Ordenar'}
          icon={ArrowUpDown}
          active={Boolean(sortBy)}
          open={showSortMenu}
          onToggle={() => {
            setShowSortMenu((current) => !current)
            setShowFilterMenu(false)
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSortBy('priority')
              setShowSortMenu(false)
            }}
            className={sortBy === 'priority' ? 'selected' : ''}
          >
            Por prioridade
          </button>
          <button
            type="button"
            onClick={() => {
              setSortBy('title')
              setShowSortMenu(false)
            }}
            className={sortBy === 'title' ? 'selected' : ''}
          >
            Por título (A-Z)
          </button>
          <button
            type="button"
            onClick={() => {
              setSortBy('progress')
              setShowSortMenu(false)
            }}
            className={sortBy === 'progress' ? 'selected' : ''}
          >
            Por progresso
          </button>
          {sortBy ? (
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                setSortBy(null)
                setShowSortMenu(false)
              }}
            >
              Limpar ordenação
            </button>
          ) : null}
        </DropdownAction>

        <DropdownAction
          label={filterTag ? 'Filtro ativo' : 'Filtrar'}
          icon={Filter}
          active={Boolean(filterTag)}
          open={showFilterMenu}
          onToggle={() => {
            setShowFilterMenu((current) => !current)
            setShowSortMenu(false)
          }}
        >
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setFilterTag(filterTag === tag ? null : tag)
                setShowFilterMenu(false)
              }}
              className={filterTag === tag ? 'selected' : ''}
            >
              {tag}
            </button>
          ))}
          {filterTag ? (
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                setFilterTag(null)
                setShowFilterMenu(false)
              }}
            >
              Limpar filtro
            </button>
          ) : null}
        </DropdownAction>
      </PageActionBar>

      {contextualHint ? (
        <ContextualHint
          title={contextualHint.title}
          description={contextualHint.description}
          actionLabel={contextualHint.actionLabel}
          onAction={contextualHint.onAction}
          onDismiss={contextualHint.onDismiss}
        />
      ) : null}

      <div className="tasks-page__content">
        {shouldRenderEmptyState ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            detail={emptyState.detail}
            quickActions={emptyState.quickActions}
            tutorialAction={emptyState.tutorialAction}
          />
        ) : content}
      </div>
    </div>
  )
}
