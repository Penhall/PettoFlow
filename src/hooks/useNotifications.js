import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setNotifications([])
      setLoading(false)
      return []
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      setNotifications([])
      setLoading(false)
      return []
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, resource_type, resource_id, read, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Erro ao buscar notificacoes:', error)
      if (mountedRef.current) setLoading(false)
      return []
    }

    if (mountedRef.current) {
      setNotifications(data ?? [])
      setLoading(false)
    }

    return data ?? []
  }, [])

  const markAsRead = useCallback(async (id) => {
    if (!supabase || !id) return false

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (error) {
      console.error('Erro ao marcar notificacao como lida:', error)
      return false
    }

    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, read: true } : notification
    )))
    return true
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!supabase) return false

    const unreadIds = notifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) return true

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)

    if (error) {
      console.error('Erro ao marcar notificacoes como lidas:', error)
      return false
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
    return true
  }, [notifications])

  useEffect(() => {
    mountedRef.current = true
    refresh()

    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  }
}
