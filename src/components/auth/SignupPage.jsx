import { useState } from 'react'
import AuthLayout from './AuthLayout.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function getSignupErrorMessage() {
  return 'Nao foi possivel criar sua conta agora.'
}

export default function SignupPage({ onSwitchToLogin }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.')
      return
    }

    setLoading(true)

    try {
      const data = await signUp(email.trim(), password, name.trim() ? { name: name.trim() } : undefined)
      if (!data.session) {
        setNotice('Conta criada. Verifique seu email para concluir o acesso, se a confirmacao estiver habilitada.')
      }
    } catch (err) {
      console.error('Erro ao criar conta:', err)
      setError(getSignupErrorMessage())
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Criar conta no NexusCRM"
      description="Comece com autenticacao real e uma base segura para a evolucao SaaS do produto."
      footer={(
        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          Ja tenho conta no NexusCRM
        </button>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Nome</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            required
          />
        </label>

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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Confirmar senha</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {error ? (
          <p style={{ margin: 0, color: 'var(--danger, #dc2626)' }}>{error}</p>
        ) : null}

        {notice ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{notice}</p>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
