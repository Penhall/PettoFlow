# Phase 4: Plan CRUD — Prompt para Claude Code

Adicionar gerenciamento de planos no admin console: criar, editar, ativar/desativar e excluir planos.

## Contexto

- `supabase/functions/admin-core/index.ts` — Edge Function admin com endpoints GET /admin/tenants, /admin/metrics, /admin/audit, /admin/billing, PATCH /admin/tenants/:id/plan, POST /admin/tenants/:id/suspend. Usa `requirePlatformAdmin()` + `getServiceRoleClient()`.
- `src/lib/adminClient.js` — Wrapper `adminFetch()`.
- `src/components/shell/SidebarRail.jsx` — Sidebar com seção "Gestão SaaS".
- `src/App.jsx` — Lazy imports e routing.

**Tabela `plans`:**
```sql
id uuid PK, name text, slug text UNIQUE, limits jsonb, price_monthly numeric(10,2),
price_yearly numeric(10,2), active boolean, created_at timestamptz, updated_at timestamptz
```

**Tabela `subscriptions`:** plan_id FK → plans.id. **Regra:** não permitir DELETE de um plano que tenha subscriptions ativas.

**Seed atual:** Free (price_monthly=0, limits: max_users=5, max_clients=100, max_tasks=500) e Growth (price_monthly=99, limits: max_users=25, max_clients=1000, max_tasks=5000).

**Função `ensure_default_subscription(p_tenant_id)`** — busca plano com slug='free'.

## O que implementar

### 1. Backend — Endpoints de planos

Adicionar em `supabase/functions/admin-core/index.ts` antes do `return ctx.fail(405)`:

**GET /admin/plans** — Lista todos os planos com:
- Campos da tabela plans
- `active_subscriptions_count` (subquery ou count separado)
- Ordenado por price_monthly ASC

**POST /admin/plans** — Cria novo plano:
- Body: { name, slug, limits, price_monthly, price_yearly }
- Validar: name e slug obrigatórios, slug único (case insensitive)
- limits default: {} (vazio = sem limite, null = herda do plano)
- active default: true
- Retornar o plano criado

**PATCH /admin/plans/:id** — Atualiza plano:
- Body: campos parciais (name, slug, limits, price_monthly, price_yearly, active)
- Se active=false e plano tem subscriptions ativas, retornar erro 409
- Retornar plano atualizado

**DELETE /admin/plans/:id** — Exclui plano:
- Se plano tem subscriptions ativas → erro 409 "Plano possui assinaturas ativas. Remova ou migre os tenants primeiro."
- Se slug='free' → erro 400 "Plano Free não pode ser excluído."
- Se OK → deleta e retorna { ok: true }

### 2. Frontend — adminClient.js

Adicionar em `src/lib/adminClient.js`:

```js
export const fetchAdminPlans = () => adminFetch('/plans')
export const createAdminPlan = (data) => adminFetch('/plans', { method: 'POST', body: data })
export const updateAdminPlan = (id, data) => adminFetch(`/plans/${id}`, { method: 'PATCH', body: data })
export const deleteAdminPlan = (id) => adminFetch(`/plans/${id}`, { method: 'DELETE' })
```

### 3. Criar src/components/admin/PlansPage.jsx

Página de gerenciamento de planos:

- Botão "Novo Plano" no topo → abre modal de criação
- Tabela de planos com colunas:
  - Nome, Slug, Preço Mensal (formatado R$), Preço Anual, Limites (resumido ex: "5 users, 100 clients"), Ativo (sim/não), Assinaturas Ativas, Ações
- Ações por linha: Editar (ícone/pencil), Excluir (ícone/trash — confirmação antes)
- Modal de criação/edição (PlanoFormModal) com campos:
  - Nome (text), Slug (text, auto-preenche do nome se vazio)
  - Preço Mensal (number), Preço Anual (number)
  - Limites: max_users, max_clients, max_tasks, max_activities, max_transactions (number inputs, 0 = sem limite)
  - Ativo (checkbox toggle)
  - Estados: loading, erro inline, validação de slug duplicado
- Modal de confirmação de exclusão: "Tem certeza que deseja excluir o plano [nome]?" com aviso se tiver subscriptions ativas (bloqueia)
- Estados: loading, erro, empty ("Nenhum plano configurado")

Usar classes CSS existentes e seguir estilo BEM: admin-plans__*, admin-plans-form__*.

### 4. Sidebar — adicionar item Planos

Adicionar em `src/components/shell/SidebarRail.jsx`: item `{ id: 'admin-plans', label: 'Planos', icon: Package }`. Importar `Package` do lucide-react.

### 5. App.jsx — adicionar rota

Modificar `src/App.jsx`:
- Lazy import: `const PlansPage = lazyWithRetry(() => import('./components/admin/PlansPage.jsx'), 'admin-plans')`
- APP_TABS: adicionar `'admin-plans'`
- Labels loading/erro
- Case no renderContent: `case 'admin-plans': return <PlansPage />`

### 6. CSS

Adicionar em `src/index.css` na seção Admin Console:

```css
.admin-plans {
  padding: 24px;
  max-width: 1200px;
}

.admin-plans__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.admin-plans-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-plans-form__row {
  display: flex;
  gap: 12px;
}

.admin-plans-form__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-plans-form__field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-plans-form__field input {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 13px;
}

.admin-plans-form__limits-title {
  font-size: 13px;
  font-weight: 600;
  margin-top: 8px;
}

.admin-plans-form__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
```

### 7. Testes

Criar `src/components/admin/__tests__/PlansPage.test.jsx`:
- Mock `fetchAdminPlans`, `createAdminPlan`, `updateAdminPlan`, `deleteAdminPlan`
- Testar loading state
- Testar renderização da tabela com dados mock (2+ planos)
- Testar empty state
- Testar abertura do modal de criação

## Regras

1. Seguir estilo: 2 spaces, single quotes, PT-BR labels, JSX
2. CSS custom properties existentes
3. border-radius: 0 (intencional)
4. Validar no backend: slug único (case insensitive), name não vazio
5. Proteger plano Free de exclusão
6. NÃO quebrar testes existentes
7. Rodar `npm run lint` e `npm test` ao final
8. Commit com prefixo `feat(admin):`
