import { useEffect, useState } from 'react'
import {
  clearWorkspaceSecret,
  hasWorkspaceEnvSecret,
  hasWorkspaceSecret,
  setWorkspaceSecret,
} from '../lib/workspaceAccess.js'
import { fetchWorkspaceBootstrap } from '../lib/workspaceCore.js'

export default function WorkspaceGate({ children }) {
  const usesEnvSecret = hasWorkspaceEnvSecret()
  const [status, setStatus] = useState(hasWorkspaceSecret() ? 'checking' : 'locked')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'checking') return

    let cancelled = false

    async function verifyWorkspaceSecret() {
      try {
        await fetchWorkspaceBootstrap()
        if (!cancelled) {
          setError('')
          setStatus('granted')
        }
      } catch (err) {
        clearWorkspaceSecret()
        if (!cancelled) {
          setStatus('locked')
          setError(
            err?.message
              ?? (usesEnvSecret
                ? 'Nao foi possivel validar a chave do workspace configurada no .env.'
                : 'Nao foi possivel validar a chave do workspace.'),
          )
        }
      }
    }

    verifyWorkspaceSecret()
    return () => {
      cancelled = true
    }
  }, [status, usesEnvSecret])

  function handleUnlock() {
    const trimmedSecret = secret.trim()
    if (!trimmedSecret) {
      setError('Informe a chave do workspace.')
      return
    }
    setWorkspaceSecret(trimmedSecret)
    setError('')
    setStatus('checking')
  }

  function handleResetAccess() {
    clearWorkspaceSecret()
    setSecret('')
    setError('')
    setStatus('locked')
  }

  if (status === 'checking') {
    return <p style={{ color: 'var(--text-secondary)', padding: 24 }}>Validando acesso ao workspace...</p>
  }

  if (status !== 'granted') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'var(--bg-primary)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            display: 'grid',
            gap: 14,
            padding: '20px 22px',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            background: 'var(--bg-secondary)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Acesso do Workspace</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
              {usesEnvSecret
                ? 'O acesso do workspace esta usando a chave configurada no arquivo .env.'
                : 'Defina VITE_WORKSPACE_ACCESS_SECRET no .env para liberar o workspace automaticamente ou informe a chave manualmente.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={usesEnvSecret ? 'Sobrescrever com outra chave' : 'Cole a chave do workspace'}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
            />
            <button onClick={handleUnlock}>Entrar</button>
          </div>

          {error && (
            <p style={{ margin: 0, color: 'var(--color-error, #ef4444)', fontSize: '0.9em' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9em',
        }}
      >
        <span>{usesEnvSecret ? 'Workspace liberado pela chave do .env.' : 'Workspace liberado nesta sessao do navegador.'}</span>
        <button onClick={handleResetAccess}>{usesEnvSecret ? 'Usar outra chave' : 'Trocar chave'}</button>
      </div>
      {children}
    </div>
  )
}
