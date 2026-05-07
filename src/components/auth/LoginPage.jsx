import { useState } from 'react'
import AuthLayout from './AuthLayout.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function getLoginErrorMessage() {
  return 'Não foi possível entrar com este email e esta senha.'
}

export default function LoginPage({ onSwitchToSignup }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(email.trim(), password)
    } catch (err) {
      console.error('Erro ao autenticar usuário:', err)
      setError(getLoginErrorMessage())
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar no NexusCRM"
      description="Organize clientes, tarefas, atividades e finanças em um único espaço de trabalho."
      footer={(
        <button
          type="button"
          onClick={onSwitchToSignup}
          style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          Criar conta no NexusCRM
        </button>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p style={{ margin: 0, color: 'var(--danger, #dc2626)' }}>{error}</p>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}
