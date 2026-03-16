// src/hooks/useReminders.js
import { useEffect, useRef } from 'react'

export function useReminders(activities, onReminder) {
  const timersRef = useRef([])

  useEffect(() => {
    // Limpar timers anteriores
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const now = Date.now()
    const pending = (activities || []).filter(
      a => a.scheduled_at && a.status === 'pending' && new Date(a.scheduled_at).getTime() > now
    )

    pending.forEach(activity => {
      const delay = new Date(activity.scheduled_at).getTime() - now
      const timerId = setTimeout(() => {
        onReminder({
          title: activity.title,
          type: activity.type,
          related_to: activity.related_to,
          id: activity.id,
        })
      }, delay)
      timersRef.current.push(timerId)
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [activities, onReminder])
}
