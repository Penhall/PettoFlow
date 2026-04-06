import { useEffect, useState } from 'react'
import { clearBotAdminSecret, hasBotAdminEnvSecret, hasBotAdminSecret, setBotAdminSecret } from '../../lib/botAdmin.js'
import { getBotConfig } from '../../lib/botConfig.js'

export default function BotAdminGate({ children }) {
  const usesEnvSecret = hasBotAdminEnvSecret()
  const [status, setStatus] = useState(hasBotAdminSecret() ? 'checking' : 'locked')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'checking') return

    let cancelled = false

    async function verifyStoredSecret() {
      try {
        await getBotConfig()
        if (!cancelled) {
          setError('')
          setStatus('granted')
        }
      } catch (err) {
        clearBotAdminSecret()
        if (!cancelled) {
          setStatus('locked')
          setError(err?.message ?? 'Não foi possível validar a chave administrativa.')
        }
      }
    }

    verifyStoredSecret()
    return () => {
      cancelled = true
    }
  }, [status])

  async function handleUnlock() {
    const trimmedSecret = secret.trim()
    if (!trimmedSecret) {
      setError('Informe a chave administrativa do bot.')
      return
    }

    setBotAdminSecret(trimmedSecret)
    setStatus('checking')
    setError('')
  }

  function handleResetAccess() {
    clearBotAdminSecret()
    setSecret('')
    setError('')
    setStatus('locked')
  }

  if (status === 'checking') {
    return <p style={{ color: 'var(--text-secondary)' }}>Validando acesso administrativo...</p>
  }

  if (status !== 'granted') {
    return (
      <div
        style={{
          display: 'grid',
          gap: 12,
          maxWidth: 560,
          padding: '16px 18px',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          background: 'var(--bg-secondary)',
        }}
      >
        <div>
          <strong>Acesso administrativo do bot</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
            {usesEnvSecret
              ? 'A chave administrativa esta configurada no .env. Clique em Liberar para continuar.'
              : 'Informe a chave `BOT_CONFIG_SECRET` para liberar a configuração do Telegram nesta sessão.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={usesEnvSecret ? 'Sobrescrever com outra chave' : 'Cole a chave administrativa'}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock()
            }}
          />
          <button onClick={usesEnvSecret && !secret ? () => setStatus('checking') : handleUnlock}>
            Liberar
          </button>
        </div>

        {error && (
          <p style={{ margin: 0, color: 'var(--color-error, #ef4444)', fontSize: '0.85em' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          {usesEnvSecret ? 'Acesso administrativo liberado pela chave do .env.' : 'Acesso administrativo liberado nesta sessao do navegador.'}
        </span>
        <button onClick={handleResetAccess}>{usesEnvSecret ? 'Usar outra chave' : 'Trocar chave'}</button>
      </div>
      {children}
    </div>
  )
}
