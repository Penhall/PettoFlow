// src/hooks/useCommandPalette.js
import { useState, useEffect, useCallback, useMemo } from 'react'

export function useCommandPalette(tasks, clients, activities) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const trigger = isMac ? e.metaKey && e.key === 'k' : e.ctrlKey && e.key === 'k'
      if (trigger) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const open = useCallback(() => { setIsOpen(true); setQuery('') }, [])
  const close = useCallback(() => { setIsOpen(false); setQuery('') }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const matchedClients = (clients || [])
      .filter(c => (c.name || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ type: 'client', id: c.id, label: c.name, sub: c.industry }))
    const matchedTasks = (tasks || [])
      .filter(t => (t.title || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(t => ({ type: 'task', id: t.id, label: t.title, sub: t.status }))
    const matchedActivities = (activities || [])
      .filter(a => (a.title || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(a => ({ type: 'activity', id: a.id, label: a.title, sub: a.type }))
    return [...matchedClients, ...matchedTasks, ...matchedActivities]
  }, [query, tasks, clients, activities])

  return { isOpen, query, setQuery, open, close, results }
}
