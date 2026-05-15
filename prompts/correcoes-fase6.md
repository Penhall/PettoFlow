# Correções Fase 6 — MFA + OAuth

Diretório: /root/PettoFlow

Aplique as correções abaixo baseadas na revisão do Claude Code.

Nota: #1 (useMfa completo em MfaChallenge) foi aceito como custo aceitável — uma query extra no login não é crítica.

## 1. src/components/auth/MfaSetup.jsx (#2 — limpar fator unverified no re-enroll)

Antes de chamar `enroll()` em `handleStart`, verificar se existe fator `totp` com `status === 'unverified'` e remover:

```javascript
async function handleStart() {
    setError('')

    // Limpar fator unverified anterior (se houver) para não esgotar limite
    const unverifiedFactor = factors.find(
      (f) => f.factor_type === 'totp' && f.status === 'unverified'
    )
    if (unverifiedFactor) {
      try {
        await unenroll(unverifiedFactor.id)
      } catch {
        // Non-critical — continua mesmo se falhar
      }
    }

    try {
      const data = await enroll()
      setFactorId(data.id)
      // ...resto
```

## 2. src/components/auth/MfaSetup.jsx (#4 — confirmação ao desativar MFA)

Adicionar `window.confirm` no início de `handleDisable`:
```javascript
async function handleDisable() {
    if (!window.confirm('Tem certeza que deseja desativar a autenticação de dois fatores? Sua conta ficará menos segura.')) return
    // resto do código existente...
```

## 3. src/components/auth/ProtectedRoute.jsx (#3 — try/catch no signOut)

Envolver `signOut()` em try/catch no onCancel:
```jsx
onCancel={async () => {
  cancelMfaChallenge()
  try {
    await signOut()
  } catch {
    // Se signOut falhar, ao menos libera o estado
  }
}}
```

## 4. src/components/auth/LoginPage.jsx (#5 — guard isConfigured, #6 loading state)

Adicionar verificação de `supabase` e loading state:

```javascript
// No corpo do componente, junto com os outros useState:
const [oauthLoading, setOauthLoading] = useState(false)

// Substituir handleGoogleLogin:
async function handleGoogleLogin() {
    setError('')
    if (!supabase) {
      setError('Cliente Supabase não configurado.')
      return
    }
    setOauthLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      if (oauthError) throw oauthError
    } catch (err) {
      console.error('Erro ao autenticar com Google:', err)
      setError('Não foi possível entrar com Google agora.')
    } finally {
      setOauthLoading(false)
    }
  }
```

No JSX, adicionar disabled:
```jsx
<button type="button" className="oauth-button oauth-button--google" onClick={handleGoogleLogin} disabled={oauthLoading}>
  {oauthLoading ? 'Redirecionando...' : 'Entrar com Google'}
</button>
```

## 5. src/components/auth/SignupPage.jsx (#5 — guard isConfigured, #6 loading state)

Mesmas alterações do LoginPage:

Adicionar `oauthLoading` state, adicionar `if (!supabase)` guard, `setOauthLoading(true/false)`, disabled no botão.

## 6. src/index.css (#7 — cores hardcoded, #8 var inexistente)

- Trocar `.mfa-setup__step--done .mfa-setup__step-number { background: #16a34a; }` por `background: var(--success, #16a34a);`
- Trocar `.mfa-challenge__error { color: #ef4444; }` por `color: var(--danger, #ef4444);`
- Trocar `.oauth-button:hover { background: var(--bg-secondary, var(--surface-muted)); }` por `background: var(--surface-muted);`

## Regras
- 2 espaços de indentação
- PT-BR em labels
- Manter estilo consistente com o código existente
