# Admin Console + Dual Shell — Implementation Plan

> **For agentic workers:** Implement step-by-step. Each task has checkbox syntax (`- [ ]`) for tracking. Run `npm run lint` and `npm test` after completing all tasks.

**Goal:** Adicionar seção "Gestão SaaS" no sidebar (visível só para platform_admin) com Dashboard, Tenants e Auditoria. Expandir `admin-core` Edge Function. Dono do SaaS usa o CRM normalmente + admin.

**Architecture:** Mesma SPA, sidebar condicional. Admin ops passam por `admin-core` Edge Function (service_role no servidor). Nenhuma chave secreta no frontend.

**Tech Stack:** React/JSX (frontend), Deno/TypeScript (Edge Functions), Supabase (PostgreSQL), Vitest + Testing Library.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `src/lib/adminClient.js` | Criar | Client HTTP para admin-core |
| `src/components/admin/AdminDashboard.jsx` | Criar | Dashboard admin (MRR, ativos, tenant count) |
| `src/components/admin/TenantsPage.jsx` | Criar | Lista de tenants + modal de detalhes |
| `src/components/admin/TenantDetailModal.jsx` | Criar | Modal de detalhes de um tenant |
| `src/components/admin/AuditPage.jsx` | Criar | Auditoria cross-tenant |
| `src/components/shell/SidebarRail.jsx` | Modificar | Adicionar seção "Gestão SaaS" condicional |
| `src/App.jsx` | Modificar | Adicionar rotas admin condicionais |
| `supabase/functions/admin-core/index.ts` | Modificar | Adicionar endpoints de admin |
| `src/components/admin/__tests__/AdminDashboard.test.jsx` | Criar | Testes do dashboard admin |

---

## Task 1: Expandir admin-core Edge Function

**Files:**
- Modify: `supabase/functions/admin-core/index.ts`

- [ ] **Step 1: Adicionar endpoint GET /admin/tenants**
  - Valida se o usuário é platform_admin
  - Retorna todos os tenants com: id, name, slug, owner_user_id, created_at
  - JOIN subscriptions → plans para plan_name
  - Subquery memberships para user_count (status = 'active')
  - JOIN auth.users para owner_email
  - Ordenado por created_at DESC

- [ ] **Step 2: Adicionar endpoint GET /admin/tenants/:id**
  - Detalhes completos de um tenant
  - Inclui informações da subscription atual

- [ ] **Step 3: Adicionar endpoint GET /admin/metrics**
  - total_tenants, active_tenants, plan_distribution, recent_tenants, mrr_total

- [ ] **Step 4: Adicionar endpoint GET /admin/audit**
  - Audit logs com paginação (page, page_size)
  - Filtros opcionais: tenant_id, event_name, date_from, date_to
  - JOIN com tenants para tenant_name

---

## Task 2: Criar adminClient.js

**Files:**
- Create: `src/lib/adminClient.js`

- [ ] **Step 1: Implementar adminFetch wrapper**
  - Pega token da sessão atual via `supabase.auth.getSession()`
  - Faz fetch para `${SUPABASE_URL}/functions/v1/admin-core${path}`
  - Headers: Authorization Bearer token, Content-Type application/json
  - Tratamento de erro: parse JSON de erro, throw com mensagem

- [ ] **Step 2: Exportar funções helpers**
  - `fetchAdminTenants()` → GET /tenants
  - `fetchAdminTenantDetail(id)` → GET /tenants/:id
  - `fetchAdminMetrics()` → GET /metrics
  - `fetchAdminAudit(filters)` → GET /audit com query params

---

## Task 3: Componente AdminDashboard.jsx

**Files:**
- Create: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Criar componente com métricas**
  - Chama `fetchAdminMetrics()` no mount
  - Grid de MetricCards: Total de Tenants, Tenants Ativos, MRR
  - Seção "Distribuição de Planos"
  - Seção "Últimos Tenants"
  - Estados: loading, erro, vazio

---

## Task 4: Componente TenantsPage.jsx

**Files:**
- Create: `src/components/admin/TenantsPage.jsx`

- [ ] **Step 1: Criar tabela de tenants**
  - Barra de busca (filtro frontend por nome)
  - Tabela: Nome, Slug, Plano, Usuários (ativos/total), Status, Criado
  - Clique na linha abre TenantDetailModal
  - Loading state, empty state

---

## Task 5: Componente TenantDetailModal.jsx

**Files:**
- Create: `src/components/admin/TenantDetailModal.jsx`

- [ ] **Step 1: Criar modal de detalhes**
  - Recebe tenantId + onClose como props
  - Chama `fetchAdminTenantDetail(tenantId)`
  - Mostra: Nome, Slug, Plano, Status, Owner, Criado em, Membros ativos
  - Usa classes CSS existentes: modal-overlay, modal, modal-header, modal-form
  - Botão Fechar

---

## Task 6: Componente AuditPage.jsx

**Files:**
- Create: `src/components/admin/AuditPage.jsx`

- [ ] **Step 1: Criar timeline de auditoria**
  - Filtros: tipo de evento (select), tenant (select), data início/fim (date inputs)
  - Lista de eventos ordenados por created_at DESC
  - Cada evento: tenant_name, event_name, created_at, payload resumido
  - Botão "Carregar mais" para paginação
  - Estados: loading, empty, erro

---

## Task 7: Modificar SidebarRail.jsx

**Files:**
- Modify: `src/components/shell/SidebarRail.jsx`

- [ ] **Step 1: Adicionar seção admin condicional**
  - Importar `useAuth` de `../../hooks/useAuth.js`
  - Após os itens normais do CRM, se `isPlatformAdmin`:
    - Divider (linha horizontal fina)
    - Label "Gestão SaaS"
    - Itens: Dashboard, Tenants, Auditoria com ícones (BarChart3, Building2, ScrollText do lucide-react)

---

## Task 8: Modificar App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Adicionar constantes e imports**
  - Const `ADMIN_TABS = new Set(['admin-dashboard', 'admin-tenants', 'admin-audit'])`
  - Adicionar ao `APP_TABS`
  - Lazy imports dos 3 componentes admin com `lazyWithRetry`
  - Labels de loading/erro para cada tab

- [ ] **Step 2: Adicionar cases no renderContent**
  - `case 'admin-dashboard'`, `case 'admin-tenants'`, `case 'admin-audit'`

---

## Task 9: Testes

**Files:**
- Create: `src/components/admin/__tests__/AdminDashboard.test.jsx`

- [ ] **Step 1: Testar AdminDashboard**
  - Mock `fetchAdminMetrics`
  - Testar loading state
  - Testar renderização com dados mock
  - Testar empty state

---

## Task 10: Verificação Final

- [ ] Rodar `npm run lint` — sem warnings
- [ ] Rodar `npm test` — todos os testes passando
- [ ] Rodar `npm run build` — build bem-sucedido
- [ ] Verificar que o sidebar admin SÓ aparece quando `isPlatformAdmin = true`
- [ ] Verificar que assinante NÃO vê seção "Gestão SaaS"
