Implementar Admin Console + Dual Shell no NexusCRM/PettoFlow.

## Contexto

O NexusCRM é um CRM para pequenas equipes. O dono do SaaS também usa o CRM para o próprio negócio (tarefas, clientes, finanças). Precisamos adicionar uma seção "Gestão SaaS" no sidebar que aparece SOMENTE para platform_admin (verificado via RPC `is_current_user_platform_admin`).

Arquitetura: mesma SPA, sidebar condicional. Admin ops passam pela Edge Function `admin-core` (já existe) que usa service_role no servidor. O frontend NUNCA segura service_role key — usa o token do usuário autenticado + a Edge Function como proxy.

Stack: React 18 + Vite (JSX puro), CSS custom properties, Supabase Edge Functions (Deno/TypeScript). Estilo: 2 spaces, single quotes, PascalCase pra componentes, camelCase pra libs.

## O que implementar

### 1. Expandir admin-core Edge Function (`supabase/functions/admin-core/index.ts`)

Adicionar endpoints:

- **GET /admin/tenants** — Lista todos os tenants com: id, name, slug, owner_user_id, created_at, plan_name (JOIN subscriptions → plans), user_count (subquery memberships WHERE status = 'active'), owner_email (JOIN auth.users). Ordenar por created_at DESC. Validar que o usuário é platform_admin antes de retornar.

- **GET /admin/tenants/:id** — Detalhes de um tenant específico. Mesmo schema do list + subscriptions info.

- **GET /admin/metrics** — Retorna: total_tenants (count), active_tenants (tenants com pelo menos 1 membership active), plan_distribution ({ free: N, growth: N }), recent_tenants (últimos 5), mrr_total (soma de subscriptions com plan=growth e status=active).

- **GET /admin/audit** — Retorna audit_logs com paginação. Query params opcionais: tenant_id, event_name, date_from, date_to, page (default 0), page_size (default 50). JOIN com tenants pra retornar tenant_name. A auditoria já existe na tabela `audit_logs` — migration `20260503003000_production_ready_foundations`.

### 2. Criar src/lib/adminClient.js

Wrapper HTTP para admin-core. Usa o token do usuário logado (supabase.auth.getSession). Não usa service_role no frontend.

```js
import { supabase } from './supabaseClient.js'
const ADMIN_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-core`

export async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão obrigatória')
  const res = await fetch(`${ADMIN_CORE_URL}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error || `Erro ${res.status}`)
  }
  return res.json()
}

export const fetchAdminTenants = () => adminFetch('/tenants')
export const fetchAdminTenantDetail = (id) => adminFetch(`/tenants/${id}`)
export const fetchAdminMetrics = () => adminFetch('/metrics')
export const fetchAdminAudit = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.tenantId) params.set('tenant_id', filters.tenantId)
  if (filters.eventName) params.set('event_name', filters.eventName)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('page_size', String(filters.pageSize))
  const qs = params.toString()
  return adminFetch(`/audit${qs ? `?${qs}` : ''}`)
}
```

### 3. Criar src/components/admin/AdminDashboard.jsx

Dashboard com métricas. Usa `fetchAdminMetrics()`. Renderiza:

- Grid de MetricCards: Total de Tenants, Tenants Ativos, MRR (mês)
- Seção "Distribuição de Planos": lista free: N, growth: N
- Seção "Últimos Tenants": lista dos 5 mais recentes com nome e data

Estados: loading ("Carregando dashboard..."), vazio, erro.

### 4. Criar src/components/admin/TenantsPage.jsx

Tabela de todos os tenants. Usa `fetchAdminTenants()`. Renderiza:

- Barra de busca (filtro por nome no frontend)
- Tabela com colunas: Nome, Slug, Plano, Usuários (ex: "2/5"), Status, Criado em
- Ao clicar numa linha, abre `TenantDetailModal`
- Loading state, empty state

### 5. Criar src/components/admin/TenantDetailModal.jsx

Modal com detalhes completos de um tenant. Recebe `tenantId` como prop, chama `fetchAdminTenantDetail(tenantId)`. Mostra:

- Nome, Slug, Plano, Status da subscription
- Owner (nome ou email)
- Data de criação
- Lista de membros ativos (se disponível no retorno)
- Botão Fechar

Usa classes CSS existentes: `modal-overlay`, `modal`, `modal-header`, `modal-form`.

### 6. Criar src/components/admin/AuditPage.jsx

Timeline de eventos cross-tenant. Usa `fetchAdminAudit()`. Renderiza:

- Filtros: tipo de evento (select), tenant (select carregado de tenants), data início/fim (date inputs)
- Lista de eventos ordenados por created_at DESC
- Cada evento: tenant_name, event_name, created_at (formatado), payload (JSON resumido)
- Botão "Carregar mais" para paginação (5 em 5)
- Estados: loading, empty ("Nenhum evento de auditoria encontrado"), erro

### 7. Modificar SidebarRail (`src/components/shell/SidebarRail.jsx`)

Após os itens do CRM, adicionar condicionalmente:

```jsx
import { useAuth } from '../../hooks/useAuth.js'

// Dentro do componente, após os itens normais:
const { isPlatformAdmin } = useAuth()

// ... depois dos itens:
{isPlatformAdmin && (
  <>
    <div style={{ height: '1px', background: 'var(--border-color)', margin: '12px 16px', opacity: 0.3 }} />
    <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
      Gestão SaaS
    </div>
    <SidebarItem icon={BarChart3} label="Dashboard" active={activeTab === 'admin-dashboard'} onClick={() => onTabChange('admin-dashboard')} />
    <SidebarItem icon={Building2} label="Tenants" active={activeTab === 'admin-tenants'} onClick={() => onTabChange('admin-tenants')} />
    <SidebarItem icon={ScrollText} label="Auditoria" active={activeTab === 'admin-audit'} onClick={() => onTabChange('admin-audit')} />
  </>
)}
```

Importe os ícones do lucide-react: `BarChart3`, `Building2`, `ScrollText`.

### 8. Modificar App.jsx (`src/App.jsx`)

- Adicionar `ADMIN_TABS` constante: `new Set(['admin-dashboard', 'admin-tenants', 'admin-audit'])`
- Adicionar ao `APP_TABS`
- Fazer lazy import dos 3 componentes admin (com `lazyWithRetry`)
- Adicionar cases no renderContent:

```jsx
case 'admin-dashboard': return <AdminDashboard />
case 'admin-tenants': return <TenantsPage />
case 'admin-audit': return <AuditPage />
```

- Adicionar labels de loading/erro para cada tab admin

### 9. Testes

Criar `src/components/admin/__tests__/AdminDashboard.test.jsx`:
- Mock `fetchAdminMetrics`
- Testar loading state
- Testar renderização com dados mock
- Testar empty state

## Regras

1. NÃO exponha service_role_key no frontend em nenhuma hipótese
2. Siga o estilo do código existente: 2 spaces, single quotes, PT-BR nos labels, lógica em inglês
3. Use CSS custom properties existentes (--text-main, --text-secondary, --border-color, --bg-main)
4. border-radius: 0 (intencional, não "corrigir")
5. Todos os componentes admin são lazy-loaded
6. NÃO quebrar testes existentes
7. Rode `npm run lint` e `npm test` ao final
