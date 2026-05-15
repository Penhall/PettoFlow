import { useEffect, useMemo, useState } from 'react'
import { Shield, ShieldOff, CheckCircle, Copy } from 'lucide-react'
import { useMfa } from '../../hooks/useMfa.js'

export default function MfaSetup() {
  const {
    factors,
    loading,
    error: hookError,
    isMfaEnrolled,
    enroll,
    challengeAndVerify,
    unenroll,
    listFactors,
  } = useMfa()
  const [step, setStep] = useState('intro')
  const [factorId, setFactorId] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const verifiedTotpFactor = useMemo(
    () => factors.find((factor) => factor.factor_type === 'totp' && factor.status === 'verified'),
    [factors]
  )

  useEffect(() => {
    if (isMfaEnrolled && step === 'intro') {
      setStep('done')
    }
  }, [isMfaEnrolled, step])

  async function handleStart() {
    setError('')

    const unverifiedFactor = factors.find(
      (factor) => factor.factor_type === 'totp' && factor.status === 'unverified'
    )
    if (unverifiedFactor) {
      try {
        await unenroll(unverifiedFactor.id)
      } catch {
        // Non-critical: keep enrollment flow available even if cleanup fails.
      }
    }

    try {
      const data = await enroll()
      setFactorId(data.id)
      setTotpUri(data.totpUri || '')
      setQrCode(data.qrCode || '')
      setSecret(data.secret || '')
      setStep('qr')
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar a configuração de 2FA.')
    }
  }

  async function handleVerify(event) {
    event.preventDefault()
    const cleanCode = verifyCode.replace(/\D/g, '').slice(0, 6)

    if (cleanCode.length !== 6) {
      setError('Informe o código de 6 dígitos do seu aplicativo autenticador.')
      return
    }

    setError('')
    try {
      await challengeAndVerify(factorId, cleanCode)
      await listFactors()
      setStep('verify')
    } catch (err) {
      console.error('Erro ao verificar MFA:', err)
      setError('Código inválido. Tente novamente.')
    }
  }

  async function handleCopySecret() {
    if (!secret || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function handleDisable() {
    if (!window.confirm('Tem certeza que deseja desativar a autenticação de dois fatores? Sua conta ficará menos segura.')) return

    const targetFactorId = verifiedTotpFactor?.id || factorId
    if (!targetFactorId) return
    await unenroll(targetFactorId)
    setFactorId('')
    setTotpUri('')
    setQrCode('')
    setSecret('')
    setVerifyCode('')
    setStep('intro')
  }

  const visibleError = error || hookError

  if (step === 'done') {
    return (
      <section className="mfa-setup">
        <div className="mfa-setup__header">
          <CheckCircle size={36} color="var(--success, #16a34a)" />
          <h2>2FA ativado</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Sua conta está protegida com autenticação de dois fatores.
          </p>
        </div>

        <div className="mfa-setup__step mfa-setup__step--done">
          <span className="mfa-setup__step-number">✓</span>
          <div>
            <strong>Status</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              Fator TOTP verificado e ativo.
            </p>
          </div>
        </div>

        {visibleError ? <p className="mfa-challenge__error">{visibleError}</p> : null}

        <button type="button" onClick={handleDisable} disabled={loading} style={{ marginTop: 16 }}>
          <ShieldOff size={16} />
          {loading ? 'Desativando...' : 'Desativar 2FA'}
        </button>
      </section>
    )
  }

  if (step === 'verify') {
    return (
      <section className="mfa-setup">
        <div className="mfa-setup__header">
          <CheckCircle size={36} color="var(--success, #16a34a)" />
          <h2>Autenticação ativada</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Guarde o acesso ao seu aplicativo autenticador. Ele será necessário nos próximos logins.
          </p>
        </div>

        <div className="mfa-setup__steps">
          <div className="mfa-setup__step mfa-setup__step--done">
            <span className="mfa-setup__step-number">✓</span>
            <div>
              <strong>Códigos de recuperação</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
                Se perder o autenticador, entre em contato com o administrador do workspace para recuperar o acesso.
              </p>
            </div>
          </div>
        </div>

        <button type="button" onClick={() => setStep('done')} style={{ marginTop: 16 }}>
          Concluir
        </button>
      </section>
    )
  }

  if (step === 'qr') {
    return (
      <section className="mfa-setup">
        <div className="mfa-setup__header">
          <Shield size={36} />
          <h2>Configurar autenticação</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Escaneie o QR code com Google Authenticator, 1Password, Authy ou outro aplicativo TOTP.
          </p>
        </div>

        <div className="mfa-setup__qr">
          {qrCode ? (
            <img src={qrCode} alt="QR code para configurar autenticação de dois fatores" />
          ) : (
            <a href={totpUri}>Abrir configuração TOTP</a>
          )}
          {secret ? (
            <button type="button" onClick={handleCopySecret} className="oauth-button">
              <Copy size={16} />
              {copied ? 'Copiado' : 'Copiar código secreto'}
            </button>
          ) : null}
          {secret ? <code className="mfa-setup__secret">{secret}</code> : null}
        </div>

        <form onSubmit={handleVerify} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Código de verificação</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verifyCode}
              onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
            />
          </label>

          {visibleError ? <p className="mfa-challenge__error">{visibleError}</p> : null}

          <button type="submit" disabled={loading || verifyCode.length !== 6}>
            {loading ? 'Verificando...' : 'Verificar e ativar'}
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="mfa-setup">
      <div className="mfa-setup__header">
        <Shield size={36} />
        <h2>Segurança da conta</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Adicione uma camada extra de proteção exigindo um código temporário nos próximos acessos.
        </p>
      </div>

      <div className="mfa-setup__steps">
        <div className="mfa-setup__step">
          <span className="mfa-setup__step-number">1</span>
          <div>
            <strong>Escaneie o QR code</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              Use seu aplicativo autenticador preferido.
            </p>
          </div>
        </div>
        <div className="mfa-setup__step">
          <span className="mfa-setup__step-number">2</span>
          <div>
            <strong>Confirme o código</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              Informe o código de 6 dígitos para ativar o 2FA.
            </p>
          </div>
        </div>
      </div>

      {visibleError ? <p className="mfa-challenge__error">{visibleError}</p> : null}

      <button type="button" onClick={handleStart} disabled={loading} style={{ marginTop: 16 }}>
        <Shield size={16} />
        {loading ? 'Preparando...' : 'Configurar autenticação de dois fatores'}
      </button>
    </section>
  )
}
