import { useMemo } from 'react'
import { ArrowUpDown, Filter } from 'lucide-react'
import { isEnabled } from '../../lib/featureFlags.js'
import BatchActionBar from './BatchActionBar.jsx'
import ContextualHint from '../onboarding/ContextualHint.jsx'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'

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
  selectedTaskIds = new Set(),
  onSelectionChange,
  onBatchMoveToColumn,
  onBatchAssign,
  onBatchDelete,
  columns = [],
  teamMembers = [],
  batchMode = false,
  emptyState = null,
  contextualHint = null,
}) {
  const shouldRenderEmptyState = Boolean(emptyState && taskCount === 0 && viewType !== 'calendar')
  const selectedCount = typeof selectedTaskIds?.size === 'number'
    ? selectedTaskIds.size
    : selectedTaskIds?.length || 0
  const taskViewItems = useMemo(() => {
    const items = [
      { id: 'kanban', label: 'Kanban' },
      { id: 'list', label: 'Lista' },
      { id: 'overview', label: 'Visão geral' },
      { id: 'files', label: 'Arquivos' },
      { id: 'calendar', label: 'Calendário' },
    ]
    if (!isEnabled('calendar_view')) {
      return items.filter(item => item.id !== 'calendar')
    }
    return items
  }, [])

  return (
    <div className="tasks-page">
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        subtitle="Gerencie pipeline, prioridades e execução diária com alta densidade operacional."
      />

      <PageTabs
        items={taskViewItems}
        activeId={viewType}
        onChange={setViewType}
        ariaLabel="Views de tarefas"
      />

      {selectedCount > 0 && batchMode && isEnabled('batch_operations') ? (
        <BatchActionBar
          selectedCount={selectedCount}
          columns={columns}
          teamMembers={teamMembers}
          onMoveToColumn={onBatchMoveToColumn}
          onAssign={onBatchAssign}
          onDelete={onBatchDelete}
          onClearSelection={() => onSelectionChange?.(new Set())}
        />
      ) : null}

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
        <div className={`board-wrapper ${shouldRenderEmptyState ? 'board-wrapper--empty' : ''}`}>
          {content}
          {shouldRenderEmptyState && emptyState && (
            <div className="board-empty-overlay">
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
                detail={emptyState.detail}
                quickActions={emptyState.quickActions}
                tutorialAction={emptyState.tutorialAction}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
