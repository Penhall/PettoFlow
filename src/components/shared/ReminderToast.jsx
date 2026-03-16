// src/components/shared/ReminderToast.jsx
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, AlertCircle } from 'lucide-react'
import { useReminders } from '../../hooks/useReminders'

const VARIANT_ICONS = {
  reminder: Bell,
  error: AlertCircle,
}

const Toast = ({ toast, onDismiss }) => {
  const Icon = VARIANT_ICONS[toast.variant] || Bell
  return (
    <motion.div
      className={`reminder-toast toast-${toast.variant}`}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.2 }}
    >
      <div className="toast-icon"><Icon size={16} /></div>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.sub && <span className="toast-sub">{toast.sub}</span>}
      </div>
      <button className="toast-close" onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
    </motion.div>
  )
}

const ReminderToast = ({ activities }) => {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((reminder) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { ...reminder, id, variant: 'reminder' }])
    setTimeout(() => dismiss(id), 8000)
  }, [dismiss])

  useReminders(activities, addToast)

  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Exporta também função utilitária para toasts de erro manuais
export function useErrorToast() {
  const [toasts, setToasts] = useState([])
  const showError = useCallback((title, sub) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, title, sub, variant: 'error' }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }, [])
  return { toasts, showError }
}

export default ReminderToast
