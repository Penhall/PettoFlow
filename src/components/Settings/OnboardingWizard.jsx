// src/components/Settings/OnboardingWizard.jsx
import { useState } from 'react'
import { saveBotConfig } from '../../lib/botConfig.js'
import { seedDefaultCommands } from '../../lib/botCommands.js'

export default function OnboardingWizard({ onConnected }) {
  const [step, setStep] = useState(1)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleConnect() {
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    try {
      await saveBotConfig({ telegramBotToken: token.trim() })
      await seedDefaultCommands()
      onConnected()
    } catch (err) {
      setError(err.message)
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
          Siga os passos — leva menos de 2 minutos
        </p>
      </div>

      {[
        {
          n: 1,
          title: 'Abra o Telegram e busque @BotFather',
          body: (
            <p>
              Envie o comando <code>/newbot</code> e siga as instruções para criar seu bot
              pessoal do PettoFlow.
            </p>
          ),
          done: step > 1,
        },
        {
          n: 2,
          title: 'Copie o token gerado pelo BotFather',
          body: (
            <p>
              Parece com: <code>1234567890:ABCDEFghijklmno...</code>
            </p>
          ),
          done: step > 2,
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
                <button onClick={handleConnect} disabled={!token.trim() || loading}>
                  {loading ? 'Conectando...' : 'Conectar →'}
                </button>
              </div>
              {error && <p style={{ color: 'var(--color-error, #ef4444)', margin: 0 }}>❌ {error}</p>}
            </div>
          ),
          done: false,
        },
        {
          n: 4,
          title: 'Autorize seu Telegram (automático)',
          body: (
            <p>
              Após conectar, envie <code>/start</code> ao bot. Ele detectará seu ID Telegram
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
            {done ? '✓' : n}
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
