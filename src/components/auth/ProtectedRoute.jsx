import { useState } from 'react'
import LoginPage from './LoginPage.jsx'
import SignupPage from './SignupPage.jsx'
import AuthLayout from './AuthLayout.jsx'
import { useAuth } from '../../hooks/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, isConfigured } = useAuth()
  const [mode, setMode] = useState('login')

  if (loading) {
    return (
      <AuthLayout
        title="Carregando NexusCRM..."
        description="Validando a sessao atual antes de liberar o dashboard."
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Aguarde enquanto sua autenticacao e verificada.</p>
      </AuthLayout>
    )
  }

  if (!isConfigured) {
    return (
      <AuthLayout
        title="Configuracao incompleta"
        description="O cliente Supabase nao esta configurado corretamente para iniciar o NexusCRM."
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
