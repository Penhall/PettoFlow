# Debug Prompt: workspace-core BOOT_ERROR on OPTIONS Preflight

## Problema

A Edge Function `workspace-core` retorna **HTTP 503 BOOT_ERROR** exclusivamente no **OPTIONS preflight**. As requisições normais (GET, POST) funcionam normalmente.

### Evidência

```
# OPTIONS → 503 BOOT_ERROR (QUEBRA)
$ curl -X OPTIONS \
  "https://.../functions/v1/workspace-core/bootstrap" \
  -H "Origin: http://localhost:5173"
→ HTTP 503 {"code":"BOOT_ERROR","message":"Function failed to start (please check logs)"}

# GET → 401 UNAUTHORIZED_LEGACY_JWT (funciona)
$ curl -X GET \
  "https://.../functions/v1/workspace-core/bootstrap" \
  -H "Authorization: Bearer <anon_key>"
→ HTTP 401 {"code":"UNAUTHORIZED_LEGACY_JWT","message":"Invalid JWT"}
```

### Impacto

O navegador faz OPTIONS preflight antes de qualquer requisição cross-origin com headers customizados (`Authorization`, `X-Tenant-Id`). Como o OPTIONS retorna 503, o navegador **bloqueia todas as requisições** ao workspace-core com `status: 0` (CORS failure). O app inteiro fica inoperante — todos os usuários veem "Não foi possível carregar o espaço de trabalho".

### Contraste: tenant-core funciona

```
$ curl -X OPTIONS \
  "https://.../functions/v1/tenant-core/tenants" \
  -H "Origin: http://localhost:5173"
→ HTTP 204 (OK ✅)
```

## Diagnóstico Realizado

### Já testado e descartado:

1. **Bundle size** — workspace-core: 704.7kB, tenant-core: 714.9kB (tenant-core é maior e funciona)
2. **Módulo CORS** — Ambos usam `import { preflight } from '../_shared/cors.ts'` (mesmo código)
3. **Module-level env vars** — Todos os `Deno.env.get()` estão dentro de funções, não no escopo do módulo
4. **Import map** — Ambos usam imports relativos para `_shared/`, nenhum depende de import_map.json
5. **Cold start vs warm** — Mesmo após aquecer com GET (worker vivo), OPTIONS ainda retorna 503 — o crash ocorre no próprio manuseio do OPTIONS

### Ruled out:
- A function foi redeployada (versão 11, bem-sucedida)
- GET requests retornam consistentemente 401 (função executa)
- OPTIONS retorna consistentemente 503 (não é intermitente)
- Nenhuma env var crítica está faltando (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY são injetadas automaticamente pelo Supabase)

## Código Relevante

### workspace-core/index.ts (linhas 145-165)

```typescript
Deno.serve(async (req: Request) => {
  const ctx = createRequestContext(req, 'workspace-core')
  req = attachRequestId(req, ctx.requestId)
  ctx.log('info', 'request_started')

  if (req.method === 'OPTIONS') return preflight(req, 'GET, POST, PATCH, DELETE, OPTIONS')
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  // ... resto do handler
})
```

### _shared/cors.ts (preflight handler)

```typescript
export function preflight(req: Request, methods = DEFAULT_METHODS) {
  const origin = req.headers.get('origin')
  if (!origin) return new Response(null, { status: 204 })

  const corsHeaders = getCorsHeaders(req, methods)
  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204, headers: corsHeaders })
}
```

### _shared/cors.ts (CORS header resolution)

```typescript
function getConfiguredOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_APP_ORIGIN')
    ?? Deno.env.get('APP_ORIGIN')
    ?? Deno.env.get('SITE_URL')
    ?? ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function originAllowed(requestOrigin: string, allowedOrigins: string[]): boolean {
  if (requestOrigin.endsWith('.vercel.app')) return true
  return allowedOrigins.some((pattern) => {
    if (pattern === '*') return true
    if (pattern.startsWith('*.')) return requestOrigin.endsWith(pattern.slice(1))
    return requestOrigin === pattern
  })
}
```

## Hipóteses a Investigar

### 1. Erro de sintaxe ou tipo no módulo que só manifesta durante avaliação inicial
O Deno pode estar encontrando um erro durante a carga do módulo que é inconsistente. Verificar:
- Tipos `!` (non-null assertion) que podem causar `undefined!`
- Imports cíclicos ou dependências quebradas
- Versão do `npm:@supabase/supabase-js@2` não compatível com o Edge Runtime

### 2. Conflito com o gateway Supabase Edge Runtime
O gateway pode estar interceptando OPTIONS e tentando validar a function antes de encaminhar. workspace-core pode ter alguma característica (headers, rota, tamanho) que faz o gateway rejeitar o preflight.

### 3. Erro no `createRequestContext()` ou `attachRequestId()` durante OPTIONS
O handler chama `createRequestContext(req, 'workspace-core')` e `attachRequestId(req, ctx.requestId)` ANTES de verificar `req.method === 'OPTIONS'`. Se alguma dessas funções lançar erro durante OPTIONS (ex.: `crypto.randomUUID()` no Supabase Edge Runtime), a function nunca atinge o preflight handler.

### 4. Configuração de ambiente diferente entre functions
Verificar se workspace-core tem variáveis de ambiente configuradas no dashboard do Supabase que tenant-core não tem (ou vice-versa), e se alguma está com valor inválido.

## Ação Requerida

1. **Corrigir o BOOT_ERROR** no OPTIONS preflight do workspace-core
2. **Redeploy** da function
3. **Verificar** que OPTIONS retorna 204 e GET/POST funcionam

Após a correção, o app poderá carregar o workspace bootstrap e os testes de frontend poderão prosseguir.

## Arquivos Envolvidos

- `supabase/functions/workspace-core/index.ts` — handler principal (669 linhas)
- `supabase/functions/_shared/cors.ts` — preflight + CORS headers
- `supabase/functions/_shared/supabase.ts` — cliente Supabase
- `supabase/functions/_shared/auth.ts` — autenticação JWT
- `supabase/functions/_shared/tenant.ts` — validação de tenant
- `supabase/functions/_shared/limits.ts` — limites do plano
- `supabase/functions/_shared/observability.ts` — request context + logging
- `supabase/functions/_shared/limit-utils.ts` — utilitários de limite
