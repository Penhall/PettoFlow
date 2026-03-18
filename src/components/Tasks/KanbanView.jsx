import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ArrowRight, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TAG_CLASS = {
  '#pesquisa': 'pesquisa',
  '#ux': 'ux',
  '#urgent': 'urgent',
  '#system': 'system',
  '#design': 'design',
  '#vendas': 'vendas',
  '#pessoal': 'pessoal',
}

const PRIORITY_CLASS = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }
const getTagClass = (tag) => TAG_CLASS[tag.toLowerCase()] ?? 'default-tag'

const SortableTaskCard = ({ task, onUpdateTask, onDeleteTask, onEditTask, isOverlay, columns }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const getNextStatus = (current) => {
    if (!columns || !columns.length) return current
    const idx = columns.findIndex(c => c.name === current)
    if (idx === -1) return columns[0].name
    return columns[(idx + 1) % columns.length].name
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${task.progress === 100 ? 'completed' : ''} ${isOverlay ? 'overlay' : ''}`}
      onClick={(e) => {
        // Don't trigger edit if clicking buttons or drag handle
        if (e.target.closest('button') || e.target.closest('.drag-handle')) return
        onEditTask(task)
      }}
    >
      <div className="card-top">
        <div className="tags">
          <div className="drag-handle" {...attributes} {...listeners}>
            <GripVertical size={14} />
          </div>
          {task.tags && task.tags.map(tag => (
            <span key={tag} className={`tag ${getTagClass(tag)}`}>{tag}</span>
          ))}
        </div>
        <button className="delete-task-btn" onClick={() => onDeleteTask(task.id)}>
          <Trash2 size={14} />
        </button>
      </div>
      <h4>{task.title}</h4>
      <div className="task-meta">
        <span className="task-owner">{task.owner}</span>
        <div className="task-actions-row">
          <span className={`priority-badge priority-${PRIORITY_CLASS[task.priority]}`}>
            {task.priority}
          </span>
          <button 
            className="status-cycle-btn" 
            onClick={() => onUpdateTask(task.id, { status: getNextStatus(task.status) })}
            title="Mudar Status"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="card-footer">
        <div className="progress-bar">
          <span>{task.progress}%</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const DroppableColumn = ({ column, tasks, children }) => {
  const { setNodeRef } = useDroppable({
    id: column.name,
  })

  return (
    <div ref={setNodeRef} className="column-content" id={column.name}>
      {children}
    </div>
  )
}

const KanbanView = ({ tasks, columns, onAddTask, onUpdateTask, onDeleteTask, onEditTask, onAddColumn, onDeleteColumn }) => {
  const [activeTask, setActiveTask] = useState(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task)
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeTask = tasks.find(t => t.id === activeId)
    const overColumn = columns.find(c => c.name === overId) || columns.find(c => c.name === tasks.find(t => t.id === overId)?.status)

    if (overColumn && activeTask.status !== overColumn.name) {
      onUpdateTask(activeId, { status: overColumn.name })
    }
  }

  const handleDragEnd = (event) => {
    setActiveTask(null)
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {columns.map((column) => {
          const columnTasks = tasks.filter(t => t.status === column.name)
          return (
            <div key={column.id} className="kanban-column">
              <div className="column-header">
                <div className="header-label">
                  <div className="status-dot" style={{ backgroundColor: column.color }} />
                  <h3>{column.name}</h3>
                  <span className="task-count">{columnTasks.length}</span>
                </div>
                <div className="header-actions">
                  <button className="icon-btn sm" onClick={() => onAddTask(column.name)}>
                    <Plus size={14} />
                  </button>
                  {columns.length > 1 && (
                    <button className="icon-btn sm danger" onClick={() => {
                      if(confirm(`Excluir coluna "${column.name}"?`)) onDeleteColumn(column.id)
                    }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <DroppableColumn column={column} tasks={columnTasks}>
                <SortableContext
                  id={column.name}
                  items={columnTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence>
                    {columnTasks.map(task => (
                      <SortableTaskCard 
                        key={task.id} 
                        task={task} 
                        columns={columns}
                        onUpdateTask={onUpdateTask}
                        onDeleteTask={onDeleteTask}
                        onEditTask={onEditTask}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>

                {columnTasks.length === 0 && (
                  <div className="empty-column">
                    <p>Arraste aqui</p>
                  </div>
                )}
              </DroppableColumn>
            </div>
          )
        })}
        <button className="add-column-card" onClick={() => {
          const name = prompt('Nome da nova coluna:')
          if (name) onAddColumn(name)
        }}>
          <Plus size={20} />
          <span>Nova Coluna</span>
        </button>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <SortableTaskCard 
            task={activeTask} 
            columns={columns}
            isOverlay 
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default KanbanView
