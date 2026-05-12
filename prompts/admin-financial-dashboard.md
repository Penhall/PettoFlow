# Phase 3: Admin Financial Dashboard — Prompt para Claude Code

Adicionar página de faturamento consolidado no admin console. Mostra MRR, receita por plano, lista de subscriptions com status, e histórico de eventos de billing.

## Contexto

- `supabase/functions/admin-core/index.ts` — Edge Function com GET /admin/tenants, /admin/metrics, /admin/audit, PATCH /admin/tenants/:id/plan, POST /admin/tenants/:id/suspend. Usa `requirePlatformAdmin()` + `getServiceRoleClient()`.
- `src/lib/adminClient.js` — Wrapper `adminFetch()` com funções exportadas.
- `src/components/admin/` — AdminDashboard, TenantsPage, TenantDetailModal, AuditPage.
- `src/components/shell/SidebarRail.jsx` — Sidebar com seção "Gestão SaaS" condicional.
- Tabelas: `plans` (id, name, slug, price_monthly, price_yearly, limits JSONB), `subscriptions` (tenant_id unique, plan_id, status, provider, current_period_end), `billing_events` (tenant_id, provider, event_id, event_type, status, error_message, created_at), `audit_logs`.
- `src/components/billing/BillingPage.jsx` — Página de billing por tenant (já existe, não mexer).

## O que implementar

### 1. Backend — GET /admin/billing

Adicionar em `supabase/functions/admin-core/index.ts`, após os endpoints existentes e antes do `return ctx.fail(405)`:

**GET /admin/billing** — Retorna visão financeira consolidada:

```typescript
// Estrutura do retorno:
{
  summary: {
    mrr_total: number,          // soma price_monthly de subscriptions ativas
    churned_mrr: number,        // soma de subscriptions inactive/canceled
    active_subscriptions: number,
    total_subscriptions: number,
    avg_revenue_per_tenant: number,  // mrr_total / active_subscriptions
  },
  by_plan: [
    { plan_name: string, active: number, mrr: number, tenants: number }
  ],
  recent_events: [              // últimos 20 billing_events
    {
      id, tenant_id, tenant_name, event_type, status,
      created_at, error_message
    }
  ],
  subscriptions_overview: [     // últimas 50 subscriptions com tenant info
    {
      tenant_id, tenant_name, plan_name, status,
      current_period_end, days_until_renewal
    }
  ]
}
```

Implementação:
- Buscar todas subscriptions com JOIN plans e tenants
- Calcular MRR total (sum price_monthly WHERE status='active')
- Agrupar por plano (plan_name, count active, sum MRR)
- Buscar últimos 20 billing_events com tenant name
- Ordenar subscriptions_overview por current_period_end ASC

### 2. Frontend — adminClient.js

Adicionar em `src/lib/adminClient.js`:

```js
export const fetchAdminBilling = () => adminFetch('/billing')
```

### 3. Criar src/components/admin/BillingPage.jsx

Página de faturamento consolidado:

- **Summary cards:** MRR Total, Churned MRR, Assinaturas Ativas, Receita Média/Tenant
- **Tabela "Por Plano":** Nome, Assinaturas Ativas, MRR, Total Tenants
- **Seção "Eventos de Billing Recentes":** timeline/lista dos últimos eventos com tenant name, tipo, status (com cor: processed=verde, failed=vermelho, received=amarelo)
- **Tabela "Assinaturas":** colunas: Tenant, Plano, Status, Vencimento, Dias Restantes
  - Status com cor: active=verde, inactive=cinza, past_due=amarelo, canceled=vermelho
- Estados: loading ("Carregando faturamento..."), erro, empty

Usar classes CSS da seção Admin Console existentes (admin-table, admin-table-wrapper, admin-panel__empty, admin-dashboard__loading, admin-dashboard__error). Criar classes novas se necessário, seguindo padrão BEM: admin-billing__*, admin-billing-table__*.

### 4. Sidebar — adicionar item Financeiro

Modificar `src/components/shell/SidebarRail.jsx`: adicionar item `{ id: 'admin-billing', label: 'Financeiro', icon: DollarSign }` na seção "Gestão SaaS". Importar `DollarSign` do lucide-react.

### 5. App.jsx — adicionar rota

Modificar `src/App.jsx`:
- Adicionar lazy import: `const BillingPage = lazyWithRetry(() => import('./components/admin/BillingPage.jsx'), 'admin-billing')`
- Adicionar ao APP_TABS: `'admin-billing'`
- Adicionar labels de loading/erro
- Adicionar case no renderContent: `case 'admin-billing': return <BillingPage />`

### 6. CSS

Adicionar em `src/index.css` na seção Admin Console:

```css
.admin-billing {
  padding: 24px;
  max-width: 1200px;
}

.admin-billing__status-active { color: var(--success); }
.admin-billing__status-inactive { color: var(--text-secondary); }
.admin-billing__status-past_due { color: var(--warning); }
.admin-billing__status-canceled { color: var(--danger); }
.admin-billing__status-processed { color: var(--success); }
.admin-billing__status-failed { color: var(--danger); }
.admin-billing__status-received { color: var(--warning); }
```

### 7. Testes

Criar `src/components/admin/__tests__/BillingPage.test.jsx`:
- Mock `fetchAdminBilling`
- Testar loading state
- Testar renderização com dados mock (summary, by_plan, recent_events, subscriptions_overview)
- Testar empty state

## Regras

1. Seguir estilo existente: 2 spaces, single quotes, PT-BR labels, JSX
2. CSS custom properties existentes
3. border-radius: 0 (intencional)
4. NÃO quebrar testes existentes
5. Rodar `npm run lint` e `npm test` ao final
6. Commit com prefixo `feat(admin):`
