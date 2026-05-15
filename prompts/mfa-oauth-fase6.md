# Fase 6: MFA + OAuth — Implementação

Adicione autenticação de dois fatores (TOTP) e login com Google OAuth ao NexusCRM.

Diretório: /root/PettoFlow

## Contexto
- React 18 + Vite (JavaScript)
- Supabase client já configurado em src/lib/supabaseClient.js (exporta `supabase`)
- `supabase.auth.mfa.*` disponível para TOTP enrollment e verificação
- `supabase.auth.signInWithOAuth()` disponível para login social
- CSS puro, classes BEM-like, variáveis CSS
- PT-BR em toda interface
- LoginPage.jsx e SignupPage.jsx existem em src/components/auth/
- App.jsx já tem lógica de roteamento baseada em hash e estado de autenticação

## Arquivos para criar

### 1. src/hooks/useMfa.js

Hook React para operações MFA via Supabase:

```javascript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export function useMfa() {
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isMfaEnrolled = factors.some(f => f.status === 'verified' && f.factor_type === 'totp')

  const listFactors = useCallback(async () => {
    if (!supabase) return []
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase.auth.mfa.listFactors()
      if (fetchError) throw fetchError
      const allFactors = data?.all ?? []
      setFactors(allFactors)
      return allFactors
    } catch (err) {
      setError(err.message || 'Erro ao listar fatores')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { listFactors() }, [listFactors])

  const enroll = useCallback(async () => {
    if (!supabase) throw new Error('Supabase nao configurado')
    setLoading(true)
    setError('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'NexusCRM',
      })
      if (enrollError) throw enrollError
      return {
        id: data.id,
        type: data.type,
        totpUri: data.totp?.uri ?? null,
        qrCode: data.totp?.qr_code ?? null,  // URL do QR code (SVG data URI)
        secret: data.totp?.secret ?? null,
      }
    } catch (err) {
      setError(err.message || 'Erro ao iniciar configuracao MFA')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const challenge = useCallback(async (factorId) => {
    if (!supabase) throw new Error('Supabase nao configurado')
    const { data, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })
    if (challengeError) throw challengeError
    return data.id  // challenge_id
  }, [])

  const verify = useCallback(async (factorId, challengeId, code) => {
    if (!supabase) throw new Error('Supabase nao configurado')
    const { data, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })
    if (verifyError) throw verifyError
    return data
  }, [])

  const challengeAndVerify = useCallback(async (factorId, code) => {
    const challengeId = await challenge(factorId)
    return verify(factorId, challengeId, code)
  }, [challenge, verify])

  const unenroll = useCallback(async (factorId) => {
    if (!supabase) throw new Error('Supabase nao configurado')
    setLoading(true)
    setError('')
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      })
      if (unenrollError) throw unenrollError
      await listFactors()
    } catch (err) {
      setError(err.message || 'Erro ao desativar 2FA')
    } finally {
      setLoading(false)
    }
  }, [listFactors])

  return {
    factors,
    loading,
    error,
    isMfaEnrolled,
    listFactors,
    enroll,
    challenge,
    verify,
    challengeAndVerify,
    unenroll,
  }
}
```

### 2. src/components/auth/MfaSetup.jsx

Componente wizard de configuração de 2FA:

Estado: step ('intro' | 'qr' | 'verify' | 'done'), factorId, totpUri, qrCode, verifyCode, error

- Step 'intro': título "Segurança da conta", descrição, botão "Configurar autenticação de dois fatores"
- Step 'qr': mostra QR code (img src=qrCode), código secreto (para copiar manual), input de 6 dígitos, botão "Verificar e ativar"
- Step 'verify': após verify bem-sucedido, mostra mensagem de sucesso + recovery codes (gerados pelo Supabase ou instrução)
- Step 'done': "2FA ativado" com badge verde + botão "Desativar 2FA" (chama unenroll)

Importa e usa useMfa hook. Inline styles ou className seguindo o padrão do projeto.

```jsx
import { useState } from 'react'
import { Shield, ShieldOff, CheckCircle, Copy } from 'lucide-react'
import { useMfa } from '../../hooks/useMfa.js'
```

### 3. src/components/auth/MfaChallenge.jsx

Tela de desafio MFA exibida após login com email+senha quando o usuário tem 2FA ativado. O App.jsx precisa detectar quando uma sessão requer MFA e exibir este componente.

```jsx
import { useState, useRef, useEffect } from 'react'
import { Shield, ArrowLeft } from 'lucide-react'
import AuthLayout from './AuthLayout.jsx'
```

Props:
- `factorId`: id do fator TOTP
- `onVerified`: callback quando MFA é verificado (recebe o session data)
- `onCancel`: callback para fazer logout

Funcionamento:
- Input de 6 dígitos, cada carácter em input separado (ou single input com maxLength=6)
- Auto-submete ao completar 6 dígitos
- Usa o hook useMfa → challengeAndVerify(factorId, code)
- Em caso de erro: "Código inválido. Tente novamente."
- Layout: centralizado, com logo do NexusCRM, "Autenticação de dois fatores", instrução

## Arquivos para modificar

### 4. src/components/auth/LoginPage.jsx

Adicionar OAuth buttons.

Encontre o formulário de login no componente. Depois do input de senha e botão de submit (mas antes do link de "Criar conta"), adicione:

```jsx
{/* Divisor OAuth */}
<div className="oauth-divider">
  <span>ou</span>
</div>

{/* OAuth Buttons */}
<div className="oauth-buttons">
  <button
    type="button"
    className="oauth-button oauth-button--google"
    onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
  >
    Entrar com Google
  </button>
</div>
```

Importe `supabase` de `../../lib/supabaseClient.js`.

### 5. src/components/auth/SignupPage.jsx

Mesma adição de OAuth buttons, entre o formulário e o link de "Já tem conta? Faça login".

### 6. src/App.jsx — Detecção de MFA necessária

Precisa detectar quando o login retorna `data?.needsMfaVerification` e renderizar MfaChallenge.

No fluxo de autenticação (onde o login é processado), adicione um estado:

```javascript
const [mfaChallenge, setMfaChallenge] = useState(null)
// mfaChallenge = { factorId: string } | null
```

Onde o login é chamado:
```javascript
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (data?.user?.factors?.length > 0) {
  // Usuário tem MFA ativo — renderizar MfaChallenge
  const totpFactor = data.user.factors.find(f => f.factor_type === 'totp' && f.status === 'verified')
  if (totpFactor) {
    setMfaChallenge({ factorId: totpFactor.id })
    return
  }
}
```

No JSX, renderizar condicionalmente:
```jsx
{mfaChallenge ? (
  <MfaChallenge
    factorId={mfaChallenge.factorId}
    onVerified={(session) => {
      setMfaChallenge(null)
      // continuar com sessão
    }}
    onCancel={() => {
      supabase.auth.signOut()
      setMfaChallenge(null)
    }}
  />
) : (
  // renderização normal do app
)}
```

Importar MfaChallenge:
```jsx
import MfaChallenge from './components/auth/MfaChallenge.jsx'
```

### 7. src/index.css

Adicionar estilos no final do arquivo:

```css
/* MFA */
.mfa-setup {
  max-width: 480px;
}
.mfa-setup__header {
  text-align: center;
  margin-bottom: 24px;
}
.mfa-setup__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  margin-bottom: 16px;
}
.mfa-setup__qr img {
  width: 180px;
  height: 180px;
}
.mfa-setup__secret {
  font-family: monospace;
  font-size: 14px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  letter-spacing: 2px;
  user-select: all;
}
.mfa-setup__steps {
  display: grid;
  gap: 16px;
}
.mfa-setup__step {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.mfa-setup__step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}
.mfa-setup__step--done .mfa-setup__step-number {
  background: #16a34a;
}

/* MFA Challenge */
.mfa-challenge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  gap: 16px;
}
.mfa-challenge__input {
  font-size: 28px;
  letter-spacing: 12px;
  text-align: center;
  width: 200px;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}
.mfa-challenge__input:focus {
  border-color: var(--primary);
}
.mfa-challenge__error {
  color: #ef4444;
  font-size: 14px;
}

/* OAuth */
.oauth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}
.oauth-buttons {
  display: grid;
  gap: 8px;
}
.oauth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.oauth-button:hover {
  background: var(--bg-secondary);
}
```

## Regras
- 2 espaços de indentação
- PT-BR em labels
- Não adicionar dependências npm novas
- Inline styles para casos simples, className para componentes reutilizáveis
- Manter estilo consistente com o código existente
