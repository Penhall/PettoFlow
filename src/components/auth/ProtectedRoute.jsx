import { useEffect, useRef, useState } from 'react'
import LoginPage from './LoginPage.jsx'
import SignupPage from './SignupPage.jsx'
import AuthLayout from './AuthLayout.jsx'
import { useAuth } from '../../hooks/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, isConfigured } = useAuth()
  const [mode, setMode] = useState('login')

  // Once the user has been authenticated at least once, NEVER show loading
  // or login again — even if the auth context flickers due to token refresh.
  // This prevents the splash screen from appearing during tab navigation.
  const authReady = useRef(false)
  const everAuthenticated = useRef(false)

  useEffect(() => {
    if (!loading) {
      authReady.current = true
    }
  }, [loading])

  useEffect(() => {
    if (isAuthenticated) {
      everAuthenticated.current = true
    } else if (!loading) {
      // Auth definitively resolved to false (loading finished, no session).
      // Clear so the login screen appears — prevents stale shell after logout
      // or session expiry. Token-refresh transients are already suppressed in
      // AuthContext, so this branch only runs on real auth loss.
      everAuthenticated.current = false
    }
  }, [isAuthenticated, loading])

  // If we've ever confirmed the user is authenticated, short-circuit
  // straight to children. No loading screen, no login redirect.
  if (everAuthenticated.current) {
    return children
  }

  // Initial load: show loading until auth resolves
  if (loading) {
    return (
      <AuthLayout
        title="Carregando NexusCRM..."
        description="Validando a sessão atual antes de liberar o dashboard."
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Aguarde enquanto sua autenticação é verificada.</p>
      </AuthLayout>
    )
  }

  if (!isConfigured) {
    return (
      <AuthLayout
        title="Configuração incompleta"
        description="O cliente Supabase não está configurado corretamente para iniciar o NexusCRM."
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para continuar.
        </p>
      </AuthLayout>
    )
  }

  if (!isAuthenticated) {
    if (mode === 'signup') {
      return <SignupPage onSwitchToLogin={() => setMode('login')} />
    }

    return <LoginPage onSwitchToSignup={() => setMode('signup')} />
  }

  return children
}
