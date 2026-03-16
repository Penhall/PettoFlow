// src/components/shared/CommandPalette.jsx
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Building2, CheckSquare, Activity, Plus } from 'lucide-react'

const TYPE_ICONS = {
  client:   Building2,
  task:     CheckSquare,
  activity: Activity,
}

const TYPE_LABELS = {
  client: 'Cliente', task: 'Tarefa', activity: 'Atividade',
}

const CommandPalette = ({ isOpen, query, setQuery, results, onClose, onSelect, onCreateActivity }) => {
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="palette-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="command-palette"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.15 }}
          >
            <div className="palette-search">
              <Search size={16} className="palette-search-icon" />
              <input
                ref={inputRef}
                type="text"
                className="palette-input"
                placeholder="Buscar cliente, tarefa ou atividade..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <span className="palette-esc">ESC</span>
            </div>

            {query.trim() ? (
              <div className="palette-results">
                {results.length === 0 ? (
                  <div className="palette-empty">
                    <p>Nenhum resultado para "{query}"</p>
                    <button className="palette-action-btn" onClick={() => { onCreateActivity(); onClose() }}>
                      <Plus size={14} /> Criar nova atividade "{query}"
                    </button>
                  </div>
                ) : (
                  results.map(item => {
                    const Icon = TYPE_ICONS[item.type] || Activity
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        className="palette-item"
                        onClick={() => { onSelect(item); onClose() }}
                      >
                        <Icon size={15} className="palette-item-icon" />
                        <span className="palette-item-label">{item.label}</span>
                        {item.sub && <span className="palette-item-sub">{item.sub}</span>}
                        <span className="palette-item-type">{TYPE_LABELS[item.type]}</span>
                      </button>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="palette-hint">
                <span>Digite para buscar • </span>
                <button className="palette-action-btn-inline" onClick={() => { onCreateActivity(); onClose() }}>
                  <Plus size={12} /> Nova atividade
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
