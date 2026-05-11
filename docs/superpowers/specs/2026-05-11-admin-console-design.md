# Admin Console + Dual Shell — Design Spec

**Data:** 2026-05-11
**Status:** Aprovado
**Branch alvo:** `feat/admin-console`

---

## Contexto

O NexusCRM é um CRM operacional para pequenas equipes. O dono do SaaS (você) também usa o CRM para o próprio negócio (clientes, tarefas, contas a receber/pagar). Atualmente não há separação entre a experiência do assinante e a administração da plataforma.

O objetivo é transformar o app em **um SPA com dois shells**:

1. **Tenant Shell** — CRM normal, scoped por `tenant_id`, com RLS. Experiência atual.
2. **Admin Shell** — O mesmo app, mas com uma seção extra no sidebar para gerenciar a plataforma: lista de tenants, auditoria, métricas, planos.

O dono (platform_admin) vê **ambos os shells**. O assinante vê só o Tenant Shell.

---

## Decisões de Design

| Questão | Decisão | Razão |
|---------|---------|-------|
| Onde renderizar admin | Mesma SPA, aba condicional no sidebar | Reusa componentes de CRM, evita split de bundle, deploy único |
| Como identificar admin | `isPlatformAdmin` (RPC existente `is_current_user_platform_admin`) | Já implementado, zero esforço |
| Dados admin vs tenant | Admin ops via Edge Function `admin-core` (service_role no servidor) | Isolamento de segurança sem sair do mesmo app |
| Rotas admin | Tab condicional no sidebar + lazy-loaded components | Mesmo padrão das tabs existentes |
| Sidebar | Seção "Gestão SaaS" aparece só para platform_admin | UX limpa, zero poluição para assinantes |
| Componentes de CRM reusados | Tasks, Clients, Finances, Calendar — mesmos componentes, tenant_id do dono | Dogfood, zero duplicação |

---

## O que o dono vê vs. o que o assinante vê

### Assinante (role: admin/member/viewer)

```
┌─────────────────────────────────────┐
│  Sidebar:                            │
│  📋 Tarefas                          │
│  👥 Clientes                         │
│  💰 Finanças                         │
│  📅 Calendário                       │
│  ⚙️ Configurações                    │
└─────────────────────────────────────┘
```

### Dono do SaaS (role: platform_admin)

```
┌─────────────────────────────────────┐
│  Sidebar:                            │
│  📋 Tarefas                          │
│  👥 Clientes                         │
│  💰 Finanças                         │
│  📅 Calendário                       │
│  ⚙️ Configurações                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─             │
│  🏢 Gestão SaaS                      │
│  ├── Dashboard                       │
│  ├── Tenants                         │
│  ├── Auditoria                       │
│  └── Planos                          │
└─────────────────────────────────────┘
```

---

## Arquitetura de Dados

### Fluxo das requisições admin

```
Frontend                     admin-core Edge Function            Supabase
   │                              │                                │
   ├─ Bearer token ──────────────►│                                │
   │                              ├─ valida token (auth.getUser)   │
   │                              ├─ valida isPlatformAdmin        │
   │                              ├─ service_role client ────────►│
   │◄──────────── JSON ──────────┤◄────── dados cross-tenant ─────│
```

**Importante:** O service_role key NÃO vai pro frontend. O admin client faz uma requisição autenticada para `admin-core` que usa service_role no servidor.

### Endpoints do `admin-core` (expandir)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /admin/tenants | Lista todos os tenants com status, plano, user count |
| GET | /admin/tenants/:id | Detalhes de um tenant |
| GET | /admin/metrics | MRR, churn, active users, plan distribution |
| GET | /admin/audit | Audit logs cross-tenant com filtros (data, tenant, evento) |
| PATCH | /admin/tenants/:id/plan | Mudar plano de um tenant |
| POST | /admin/tenants/:id/suspend | Suspender tenant |

---

## Novos Componentes

### AdminDashboard.jsx
- Cards de métrica: MRR (mês), Total de Tenants, Tenants Ativos
- Lista compacta dos últimos 5 tenants criados
- Distribuição de planos (free vs growth)

### TenantsPage.jsx
- Tabela com busca e filtros
- Colunas: Nome, Slug, Plano, Users (ativos/total), Status, Criado em
- Ações: Ver detalhes, Mudar plano, Suspender
- Modal de detalhes com informações completas do tenant

### AuditPage.jsx
- Timeline de eventos cross-tenant
- Filtros: tipo de evento, tenant, data
- Linha do tempo estilizada

---

## Non-goals

- Não mexer no modelo de dados existente (tenants, memberships, subscriptions)
- Não quebrar testes existentes
- Não mudar experiência do assinante
- Não criar novo deploy ou domínio
