import { useCallback, useEffect, useRef, useState } from 'react'
import { Shield, ArrowLeft } from 'lucide-react'
import AuthLayout from './AuthLayout.jsx'
import { useMfa } from '../../hooks/useMfa.js'

export default function MfaChallenge({ factorId, onVerified, onCancel }) {
  const { challengeAndVerify } = useMfa()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submittedCodeRef = useRef('')
  const inputRef = useRef(null)

  const handleVerify = useCallback(async (nextCode = code) => {
    const cleanCode = nextCode.replace(/\D/g, '').slice(0, 6)
    if (cleanCode.length !== 6 || loading || submittedCodeRef.current === cleanCode) return

    submittedCodeRef.current = cleanCode
    setLoading(true)
    setError('')

    try {
      const data = await challengeAndVerify(factorId, cleanCode)
      onVerified(data)
    } catch (err) {
      console.error('Erro ao validar MFA:', err)
      submittedCodeRef.current = ''
      setCode('')
      setError('Código inválido. Tente novamente.')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }, [challengeAndVerify, code, factorId, loading, onVerified])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (code.length === 6) {
      void handleVerify(code)
    }
  }, [code, handleVerify])

  return (
    <AuthLayout
      title="Autenticação de dois fatores"
      description="Informe o código de 6 dígitos do seu aplicativo autenticador para continuar."
      footer={(
        <button
          type="button"
          onClick={onCancel}
          style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          <ArrowLeft size={14} />
          Voltar para login
        </button>
      )}
    >
      <div className="mfa-challenge">
        <Shield size={42} />
        <input
          ref={inputRef}
          className="mfa-challenge__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="Código de autenticação de dois fatores"
          maxLength={6}
          disabled={loading}
        />
        {error ? <p className="mfa-challenge__error">{error}</p> : null}
        <button type="button" onClick={() => handleVerify()} disabled={loading || code.length !== 6}>
          {loading ? 'Verificando...' : 'Verificar código'}
        </button>
      </div>
    </AuthLayout>
  )
}
