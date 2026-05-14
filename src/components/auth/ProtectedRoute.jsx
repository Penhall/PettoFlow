import { useEffect, useState } from 'react'
import LoginPage from './LoginPage.jsx'
import SignupPage from './SignupPage.jsx'
import AuthLayout from './AuthLayout.jsx'
import { useAuth } from '../../hooks/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, isConfigured } = useAuth()
  const [mode, setMode] = useState('login')

  // Track when auth has loaded at least once. Once true, never flicker back to
  // loading — prevents splash screen on tab navigation and token refresh.
  // Initialized from current loading state so Supabase-misconfigured environments
  // (loading starts false) skip the loading screen entirely.
  const [authInitialized, setAuthInitialized] = useState(!loading)

  useEffect(() => {
    if (!loading) setAuthInitialized(true)
  }, [loading])

  // Show loading only during first auth resolution
  if (!authInitialized) {
    return (
      <AuthLayout
        title="Carregando NexusCRM..."
        description="Validando a sessão atual antes de liberar o dashboard."
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Aguarde enquanto sua autenticação é verificada.
        </p>
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

  // isAuthenticated is React state — triggers rerender when it changes.
  // Auth loss (real logout/expiry) sets it false, causing an immediate rerender
  // that shows the login screen. Token-refresh transients are suppressed by
  // AuthContext so this never fires spuriously.
  if (!isAuthenticated) {
    if (mode === 'signup') {
      return <SignupPage onSwitchToLogin={() => setMode('login')} />
    }

    return <LoginPage onSwitchToSignup={() => setMode('signup')} />
  }

  return children
}
