# Correções de Estabilidade e Usabilidade — NexusCRM

Diretório: /root/PettoFlow

Aplique as correções abaixo para resolver congelamento, lentidão e problemas de usabilidade.

## 1. src/lib/lazyWithRetry.js — Retry persistente entre renders

Adicionar sessionStorage para evitar loops infinitos de chunk loading:

```javascript
import { lazy } from 'react'

const MAX_RETRY_ATTEMPTS = 2
const RETRY_DELAYS_MS = [250, 1000]
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

function isChunkLoadError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return CHUNK_ERROR_PATTERN.test(message)
}

function wait(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

export async function loadWithRetry(importer, cacheKey) {
  let lastError = null

  // Verificar sessionStorage: já tentamos N vezes nesta sessão?
  const retryKey = `chunk_retry_${cacheKey}`
  const attemptCount = Number(sessionStorage.getItem(retryKey) || 0)
  if (attemptCount > MAX_RETRY_ATTEMPTS) {
    // Já falhou o máximo de vezes nesta sessão — não tentar de novo
    sessionStorage.removeItem(retryKey)
    throw new Error(`ChunkLoadError: ${cacheKey} excedeu tentativas`)
  }

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      // Se conseguiu carregar, limpar contagem de erros
      sessionStorage.removeItem(retryKey)
      return await importer()
    } catch (error) {
      lastError = error

      if (!isChunkLoadError(error) || attempt === MAX_RETRY_ATTEMPTS || typeof window === 'undefined') {
        throw error
      }

      console.warn(
        `Falha ao carregar chunk lazy "${cacheKey}". Tentando novamente (${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`,
        error,
      )

      await wait(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1])
    }
  }

  // Se chegou aqui, todas as tentativas falharam — registrar no sessionStorage
  sessionStorage.setItem(retryKey, String(attemptCount + 1))

  throw lastError
}

export function lazyWithRetry(importer, cacheKey) {
  return lazy(() => loadWithRetry(importer, cacheKey))
}
```

Mudanças-chave:
- Antes do loop, verifica `sessionStorage.getItem('chunk_retry_'+cacheKey)` — se já excedeu o limite, joga erro sem tentar
- No sucesso, limpa o contador (`sessionStorage.removeItem`)
- Na falha total, incrementa o contador (`sessionStorage.setItem`)
- O ViewErrorBoundary pode então mostrar "Recarregar página" que dá `window.location.reload()` e reseta o sessionStorage

## 2. src/components/shared/ViewErrorBoundary.jsx — Botão "Recarregar página"

Substituir o botão "Tentar novamente" — para chunk errors, o único caminho confiável é recarregar a página:

```jsx
action={
  isChunkError ? (
    <button
      type="button"
      className="page-action-bar__button page-action-bar__button--primary"
      onClick={() => { window.location.reload() }}
    >
      Recarregar página
    </button>
  ) : (
    <button
      type="button"
      className="page-action-bar__button page-action-bar__button--primary"
      onClick={() => {
        this.setState({ hasError: false, error: null })
      }}
    >
      Tentar novamente
    </button>
  )
}
```

Mudança: se for chunk error → "Recarregar página" (window.location.reload). Se for outro erro → "Tentar novamente" (reset do estado).

## 3. src/context/AuthContext.jsx — Só limpar sessão após confirmar morte

No handler `handleAuthStateChange`, mover `setSession(null)` e `setUser(null)` para DENTRO do bloco que confirma que a sessão realmente morreu:

```javascript
async function handleAuthStateChange(_event, nextSession) {
    if (!active) return

    // Supabase sometimes emits SIGNED_OUT before TOKEN_REFRESHED
    // during a token refresh. Verify the session is really gone
    // before clearing.
    if (_event === 'SIGNED_OUT' && !nextSession) {
      const { data: current } = await supabase.auth.getSession()
      if (!active) return
      if (current?.session) {
        // Session is still alive — this is a transient SIGNED_OUT
        // during token refresh. Don't clear; TOKEN_REFRESHED follows.
        return
      }
      // Sessão realmente morreu — só agora limpar
      setSession(null)
      setUser(null)
      if (!initialLoadResolved) {
        await syncPlatformAdmin(null, () => active)
        if (active) {
          initialLoadResolved = true
          setLoading(false)
        }
      }
      return
    }

    const resolvedSession = nextSession ?? null
    setSession(resolvedSession)
    setUser(resolvedSession?.user ?? null)

    // loading should only transition true→false once (initial mount).
    if (!initialLoadResolved) {
      await syncPlatformAdmin(resolvedSession, () => active)
      if (active) {
        initialLoadResolved = true
        setLoading(false)
      }
    } else {
      syncPlatformAdmin(resolvedSession, () => active).catch(() => {})
    }
  }
```

Mudança: `setSession(null)` e `setUser(null)` foram movidos para dentro do `if (_event === 'SIGNED_OUT')` depois da verificação `getSession()`, com `return` no final. Antes estavam fora e executavam mesmo quando o SIGNED_OUT era transiente.

## 4. src/App.jsx — Renomear "Tenants" para "Clientes"

No array `APP_TABS` (linha ~57), alterar `'admin-tenants'` para manter como está (não muda a tab id). 

O label das tabs está em `TAB_LOADING_LABELS` e `TAB_ERROR_LABELS`. Trocar:
```
'admin-tenants': 'Carregando tenants...' → 'Carregando clientes...'
'admin-tenants': 'a lista de tenants' → 'a lista de clientes'
```

## 5. src/components/admin/TenantsPage.jsx — Título

Alterar título "Tenants" para "Clientes" na página.

Procure por `<PageHeader` e altere:
- `title="Tenants"` → `title="Clientes"`  
- Qualquer outro texto "Tenant" no header → "Cliente"
- Subtítulo que menciona "tenants" → "clientes"

## 6. supabase/functions/_shared/onboarding.ts — Seed de tarefas tutorial

Na função `seedTenantOnboardingData`, APÓS o seed de dados existentes (após inserir activities, clients ou o que já for seedado), adicionar inserção de tarefas de tutorial:

```typescript
// Seed tasks de tutorial
const { data: columns } = await client
  .from('kanban_columns')
  .select('id, name')
  .eq('tenant_id', tenantId)
  .order('order_index', { ascending: true })
  .limit(1)

const firstColumnId = (columns ?? [])[0]?.id

if (firstColumnId) {
  const tutorialTasks = [
    { tenant_id: tenantId, title: '📋 Explore o Kanban — arraste tarefas entre colunas', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
    { tenant_id: tenantId, title: '📅 Agende uma atividade no Calendário', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
    { tenant_id: tenantId, title: '🤖 Conecte o Bot do Telegram', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
    { tenant_id: tenantId, title: '👥 Convide um membro para o workspace', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
    { tenant_id: tenantId, title: '💰 Registre uma transação financeira', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
    { tenant_id: tenantId, title: '✅ Complete o tour de onboarding', status: 'A Fazer', kanban_column_id: firstColumnId, origin_type: 'onboarding_seed' },
  ]

  const { error: tasksError } = await client.from('tasks').insert(tutorialTasks)
  if (tasksError) {
    console.log(`onboarding: erro ao seedar tarefas tutorial para tenant ${tenantId}:`, tasksError.message)
  }
}
```

Procure a função `seedTenantOnboardingData` no arquivo e encontre o local apropriado após os seeds de onboarding já existentes. Verifique a estrutura do arquivo para entender o padrão.

## Regras
- 2 espaços de indentação
- PT-BR em labels
- Manter estilo consistente com o código existente
- Não quebrar imports ou assinaturas de função
