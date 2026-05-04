import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { AuthContext } from './authContext.js'

function getMissingConfigError() {
  return new Error('O cliente Supabase nao esta configurado com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  async function syncPlatformAdmin(nextSession, isActive = () => true) {
    if (!supabase || !nextSession) {
      if (isActive()) setIsPlatformAdmin(false)
      return false
    }

    const { data, error } = await supabase.rpc('is_current_user_platform_admin')
    if (!isActive()) return false

    if (error) {
      console.error('Erro ao carregar flag administrativa global:', error)
      setIsPlatformAdmin(false)
      return false
    }

    const nextValue = Boolean(data)
    setIsPlatformAdmin(nextValue)
    return nextValue
  }

  useEffect(() => {
    let active = true

    async function loadSession() {
      if (!supabase) {
        if (active) setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        console.error('Erro ao carregar sessao inicial:', error)
      }

      const nextSession = data?.session ?? null
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      await syncPlatformAdmin(nextSession, () => active)
      setLoading(false)
    }

    loadSession()

    if (!supabase) {
      return () => {
        active = false
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      const resolvedSession = nextSession ?? null
      setSession(resolvedSession)
      setUser(resolvedSession?.user ?? null)
      syncPlatformAdmin(resolvedSession, () => active).finally(() => {
        if (active) setLoading(false)
      })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function refreshSession() {
    if (!supabase) {
      throw getMissingConfigError()
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error

    const nextSession = data?.session ?? null
    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    await syncPlatformAdmin(nextSession)
    return nextSession
  }

  async function signIn(email, password) {
    if (!supabase) {
      throw getMissingConfigError()
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, metadata) {
    if (!supabase) {
      throw getMissingConfigError()
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(metadata ? { data: metadata } : {}),
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) throw error
    return data
  }

  async function signOut() {
    if (!supabase) {
      throw getMissingConfigError()
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: Boolean(session),
        isPlatformAdmin,
        isConfigured: Boolean(supabase),
        signIn,
        signUp,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
