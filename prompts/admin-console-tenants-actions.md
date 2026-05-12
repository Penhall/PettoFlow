# Phase 2: Admin Tenant Actions — Prompt para Claude Code

Adicionar ações administrativas nos tenants: mudar de plano, suspender/reativar. Atualizar o backend `admin-core` e o frontend `TenantDetailModal`.

## Contexto

- `supabase/functions/admin-core/index.ts` — Edge Function que já tem GET /admin/tenants, /admin/tenants/:id, /admin/metrics, /admin/audit. Usa `requireAuthenticatedUser()` + `requirePlatformAdmin()` + `getServiceRoleClient()`.
- `src/lib/adminClient.js` — Wrapper HTTP com `adminFetch()`. Exporta `fetchAdminTenants`, `fetchAdminTenantDetail`, `fetchAdminMetrics`, `fetchAdminAudit`.
- `src/components/admin/TenantDetailModal.jsx` — Modal que mostra detalhes do tenant. Usa classes CSS existentes: modal-overlay, modal, modal-header, modal-form, modal-actions.
- `src/index.css` — Classes CSS admin já existem: admin-detail-grid, admin-detail-field, admin-detail-field__label, admin-detail-field__value, admin-detail-members, admin-panel__empty, action-btn, icon-btn.
- Tabelas: `plans` (id, name, slug, price_monthly, active), `subscriptions` (tenant_id unique, plan_id, status), `audit_logs` (tenant_id, user_id, action, resource_type, metadata).
- `public.ensure_default_subscription(p_tenant_id)` — função PL/pgSQL que garante assinatura free.

## O que implementar

### 1. Backend — admin-core novos endpoints

Adicionar em `supabase/functions/admin-core/index.ts`, depois do bloco GET /audit e antes do `return ctx.fail(405)`:

#### a) PATCH /admin/tenants/:id/plan

Body: `{ "plan_slug": "growth" }`

Fluxo:
- Busca o plano pelo slug em `plans` (lower(slug) = plan_slug). Se não existir, retorna 404.
- Busca a subscription do tenant. Se existir, faz UPDATE: plan_id, updated_at = now(). Se não existir, faz INSERT com status='active', provider='internal'.
- Registra em audit_logs: action='subscription.plan_changed', resource_type='subscription', metadata={ from_plan, to_plan }.
- Retorna { ok: true, subscription: { ... } }

#### b) POST /admin/tenants/:id/suspend

Body: `{ "action": "suspend" | "reactivate" }`

Fluxo:
- Se action='suspend': atualiza subscriptions.status='inactive'. Registra audit_logs com action='tenant.suspended'.
- Se action='reactivate': atualiza subscriptions.status='active'. Chama ensure_default_subscription se não existir subscription. Registra audit_logs action='tenant.reactivated'.
- Retorna { ok: true }

### 2. Frontend — adminClient.js novos métodos

Adicionar em `src/lib/adminClient.js`:

```js
export async function updateTenantPlan(tenantId, planSlug) {
  return adminFetch(`/tenants/${tenantId}/plan`, {
    method: 'PATCH',
    body: { plan_slug: planSlug },
  })
}

export async function suspendTenant(tenantId) {
  return adminFetch(`/tenants/${tenantId}/suspend`, {
    method: 'POST',
    body: { action: 'suspend' },
  })
}

export async function reactivateTenant(tenantId) {
  return adminFetch(`/tenants/${tenantId}/suspend`, {
    method: 'POST',
    body: { action: 'reactivate' },
  })
}
```

### 3. Frontend — TenantDetailModal com ações

Modificar `src/components/admin/TenantDetailModal.jsx`:

- Adicionar seção de ações abaixo dos detalhes:
  - Select pra mudar de plano (free / growth), com botão "Alterar Plano"
  - Botão "Suspender Tenant" (se status = active) ou "Reativar Tenant" (se status = inactive)
- Cada ação mostra estado de loading (desabilita botão enquanto processa)
- Cada ação mostra feedback de sucesso/erro inline
- Após sucesso, recarrega os detalhes do tenant automaticamente (refetch)
- Usar classes CSS existentes: action-btn para botões, admin-dashboard__error para erro, e criar inline styles ou classes novas só se estritamente necessário

Importar: `updateTenantPlan`, `suspendTenant`, `reactivateTenant` de `../../lib/adminClient.js`.

### 4. CSS — adicionar classes de ação

Adicionar em `src/index.css` na seção Admin Console:

```css
.admin-detail-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.admin-detail-actions__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.admin-detail-actions__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.admin-detail-actions__select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 13px;
}

.admin-detail-actions__feedback {
  font-size: 12px;
  margin-top: 4px;
}

.admin-detail-actions__feedback--success {
  color: var(--success);
}

.admin-detail-actions__feedback--error {
  color: var(--danger);
}
```

### 5. Testes

Criar `src/components/admin/__tests__/TenantDetailModal.test.jsx`:
- Testar renderização (loading, dados mock)
- Mockar os 3 métodos novos: updateTenantPlan, suspendTenant, reactivateTenant
- Verificar que botões aparecem com dados corretos

## Regras

1. Seguir estilo existente: 2 spaces, single quotes, PT-BR labels, JSX
2. Usar CSS custom properties existentes
3. border-radius: 0 (intencional)
4. NÃO quebrar testes existentes
5. Rodar `npm run lint` e `npm test` ao final
6. Commit com prefixo `feat(admin): ...` ou `fix(admin): ...`
