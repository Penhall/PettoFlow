# Admin Financial Dashboard — Implementation Plan

**Goal:** Adicionar página de faturamento consolidado no admin console (MRR, receita por plano, subscriptions, eventos de billing).

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `supabase/functions/admin-core/index.ts` | Modificar | Adicionar GET /admin/billing |
| `src/lib/adminClient.js` | Modificar | Adicionar fetchAdminBilling |
| `src/components/admin/BillingPage.jsx` | Criar | Página de faturamento consolidado |
| `src/components/shell/SidebarRail.jsx` | Modificar | Adicionar item "Financeiro" no admin |
| `src/App.jsx` | Modificar | Lazy import + rota admin-billing |
| `src/index.css` | Modificar | Classes de status billing |
| `src/components/admin/__tests__/BillingPage.test.jsx` | Criar | Testes |

---

## Task 1: Backend — GET /admin/billing

- [ ] Buscar subscriptions + plans + tenants
- [ ] Calcular mrr_total (price_monthly das active)
- [ ] Calcular churned_mrr (inactive/canceled)
- [ ] Agrupar por plano
- [ ] Buscar últimos 20 billing_events com tenant name
- [ ] Montar subscriptions_overview com dias até renovação

## Task 2: Frontend — adminClient.js

- [ ] Adicionar fetchAdminBilling()

## Task 3: BillingPage.jsx

- [ ] Summary cards (MRR, Churned, Ativas, Média)
- [ ] Tabela "Por Plano"
- [ ] Eventos de billing recentes
- [ ] Tabela de subscriptions
- [ ] Loading/error/empty states

## Task 4: Sidebar + App.jsx

- [ ] Sidebar: item "Financeiro" com DollarSign
- [ ] App.jsx: lazy import, tab, label, renderContent

## Task 5: CSS

- [ ] Classes de status (active, inactive, past_due, canceled, processed, failed, received)

## Task 6: Testes

- [ ] BillingPage.test.jsx com mock de dados

## Verificação Final

- [ ] `npm run lint` sem warnings
- [ ] `npm test` passando
- [ ] `npm run build` bem-sucedido
