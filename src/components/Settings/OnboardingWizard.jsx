// src/components/Settings/OnboardingWizard.jsx
import { useState } from 'react'
import { saveBotConfig } from '../../lib/botConfig.js'
import { seedDefaultCommands } from '../../lib/botCommands.js'
import { normalizeError } from '../../lib/mutationResult.js'

export default function OnboardingWizard({ tenantId, onConnected }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const hasToken = token.trim().length > 0

  async function handleConnect() {
    const trimmedToken = token.trim()
    if (!trimmedToken) return

    setLoading(true)
    setError(null)

    try {
      try {
        await saveBotConfig({ tenantId, telegramBotToken: trimmedToken })
      } catch (err) {
        setError(normalizeError(err, { operation: 'telegram.connect' }).message)
        return
      }

      try {
        await seedDefaultCommands(tenantId)
      } catch (err) {
        console.warn('Seed de comandos falhou (nao critico):', err)
      }

      await onConnected?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '2em', marginBottom: 8 }}>🤖</div>
        <h2 style={{ margin: 0 }}>Conectar Bot Telegram</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Siga os passos - leva menos de 2 minutos
        </p>
      </div>

      {[
        {
          n: 1,
          title: 'Abra o Telegram e busque @BotFather',
          body: (
            <p>
              Envie o comando <code>/newbot</code> e siga as instrucoes para criar seu bot
              pessoal do NexusCRM.
            </p>
          ),
          done: hasToken,
        },
        {
          n: 2,
          title: 'Copie o token gerado pelo BotFather',
          body: (
            <p>
              Parece com: <code>1234567890:ABCDEFghijklmno...</code>
            </p>
          ),
          done: hasToken,
        },
        {
          n: 3,
          title: 'Cole o token aqui',
          body: (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="1234567890:ABCDEFghijklmnopqrstuvwxyz"
                  style={{ flex: 1 }}
                  disabled={loading}
                />
                <button onClick={handleConnect} disabled={!hasToken || loading}>
                  {loading ? 'Conectando...' : 'Conectar ->'}
                </button>
              </div>
              {error && (
                <p style={{ color: 'var(--color-error, #ef4444)', margin: 0 }}>X {error}</p>
              )}
            </div>
          ),
          done: false,
        },
        {
          n: 4,
          title: 'Autorize seu Telegram (automatico)',
          body: (
            <p>
              Apos conectar, envie <code>/start</code> ao bot. Ele detectara seu ID Telegram
              automaticamente.
            </p>
          ),
          done: false,
          disabled: true,
        },
      ].map(({ n, title, body, done, disabled }) => (
        <div
          key={n}
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 10,
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            opacity: disabled ? 0.5 : 1,
            borderColor: done ? 'var(--color-success, #16a34a)' : 'var(--border-color)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: done ? 'var(--color-success, #16a34a)' : 'var(--bg-secondary)',
              color: done ? 'white' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {done ? 'OK' : n}
          </div>
          <div style={{ flex: 1 }}>
            <strong>{title}</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
