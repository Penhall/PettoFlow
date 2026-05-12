# Admin Tenant Actions — Implementation Plan

> **For Claude Code:** Implement step-by-step. Each task has checkbox syntax.

**Goal:** Adicionar ações administrativas nos tenants: mudar de plano, suspender/reativar. Atualizar backend admin-core e frontend TenantDetailModal.

**Architecture:** Mesma Edge Function admin-core, mesmo SPA. Ações passam por admin-core com service_role.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `supabase/functions/admin-core/index.ts` | Modificar | Adicionar PATCH /admin/tenants/:id/plan + POST /admin/tenants/:id/suspend |
| `src/lib/adminClient.js` | Modificar | Adicionar updateTenantPlan, suspendTenant, reactivateTenant |
| `src/components/admin/TenantDetailModal.jsx` | Modificar | Adicionar seção de ações (mudar plano, suspender/reativar) |
| `src/index.css` | Modificar | Adicionar classes de ações admin |
| `src/components/admin/__tests__/TenantDetailModal.test.jsx` | Criar | Testes do modal com ações |

---

## Task 1: Backend — PATCH /admin/tenants/:id/plan

- [ ] Buscar plano por slug em `plans` (lower -> case insensitive)
- [ ] Se plano não existir, retornar 404
- [ ] Se subscription existir, fazer UPDATE com novo plan_id
- [ ] Se subscription não existir, fazer INSERT com status='active', provider='internal'
- [ ] Registrar em audit_logs com action='subscription.plan_changed'
- [ ] Retornar { ok: true, subscription: { ... } }

## Task 2: Backend — POST /admin/tenants/:id/suspend

- [ ] Validar body.action in ['suspend', 'reactivate']
- [ ] Suspend: subscriptions.status = 'inactive', audit action='tenant.suspended'
- [ ] Reactivate: subscriptions.status = 'active', ensure_default_subscription se não existir, audit action='tenant.reactivated'
- [ ] Retornar { ok: true }

## Task 3: Frontend — adminClient.js

- [ ] Adicionar updateTenantPlan(tenantId, planSlug) → PATCH /tenants/${id}/plan
- [ ] Adicionar suspendTenant(tenantId) → POST /tenants/${id}/suspend
- [ ] Adicionar reactivateTenant(tenantId) → POST /tenants/${id}/suspend

## Task 4: Frontend — TenantDetailModal

- [ ] Adicionar select de plano com botão "Alterar Plano"
- [ ] Adicionar botão "Suspender Tenant" ou "Reativar Tenant" (condicional)
- [ ] Loading state em cada ação (desabilitar botão)
- [ ] Feedback de sucesso/erro inline
- [ ] Refetch dos detalhes após sucesso

## Task 5: CSS

- [ ] Adicionar classes: admin-detail-actions, admin-detail-actions__title, admin-detail-actions__row, admin-detail-actions__select, admin-detail-actions__feedback

## Task 6: Testes

- [ ] Criar TenantDetailModal.test.jsx
- [ ] Mockar updateTenantPlan, suspendTenant, reactivateTenant
- [ ] Testar loading, renderização, botões visíveis

## Verificação Final

- [ ] `npm run lint` sem warnings
- [ ] `npm test` todos passando
- [ ] `npm run build` bem-sucedido
