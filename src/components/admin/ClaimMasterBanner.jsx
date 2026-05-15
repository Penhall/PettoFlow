import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { adminFetch } from '../../lib/adminClient.js'
import { normalizeError } from '../../lib/mutationResult.js'
import { PRODUCT } from '../../content/uxText.js'

export default function ClaimMasterBanner({ onClaimed }) {
  const [isEmpty, setIsEmpty] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.rpc('is_platform_admins_table_empty').then(({ data }) => {
      setIsEmpty(Boolean(data))
    })
  }, [])

  if (!isEmpty) return null

  async function handleClaim() {
    setClaiming(true)
    setError(null)
    try {
      await adminFetch('/claim-master', { method: 'POST' })
      onClaimed()
    } catch (err) {
      setError(normalizeError(err, { operation: 'admin.claimMaster' }).message)
      setClaiming(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(180deg, var(--bg-main) 0%, var(--bg-secondary) 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 32,
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg, var(--bg-sidebar))',
          boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.12))',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
          }}
        >
          {PRODUCT.name}
        </p>
        <h2
          style={{
            margin: '10px 0 8px',
            fontSize: '1.75rem',
            lineHeight: 1.2,
            color: 'var(--text-primary)',
          }}
        >
          Bem-vindo à administração da plataforma
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Nenhum administrador foi configurado ainda. Reivindique o acesso master
          para gerenciar espaços de trabalho, planos e configurações da plataforma.
        </p>

        {error && (
          <p
            style={{
              margin: '16px 0 0',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--error-bg, rgba(239,68,68,0.1))',
              color: 'var(--error, #ef4444)',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            className="auth-submit"
            disabled={claiming}
            onClick={handleClaim}
          >
            {claiming ? 'Reivindicando...' : 'Reivindicar como Master'}
          </button>
        </div>
      </div>
    </div>
  )
}
