// src/components/shared/RecordSidebar.jsx
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const RecordSidebar = ({ isOpen, onClose, title, subtitle, children }) => {
  // Fecha com Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="sidebar-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          {/* Painel */}
          <motion.aside
            className="record-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="record-sidebar-header">
              <div>
                <h2 className="record-sidebar-title">{title}</h2>
                {subtitle && <span className="record-sidebar-subtitle">{subtitle}</span>}
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="record-sidebar-body">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default RecordSidebar
