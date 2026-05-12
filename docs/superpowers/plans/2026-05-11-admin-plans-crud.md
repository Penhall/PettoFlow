# Admin Plans CRUD — Implementation Plan

**Goal:** Adicionar CRUD de planos no admin console (criar, editar, ativar/desativar, excluir planos).

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `supabase/functions/admin-core/index.ts` | Modificar | GET/POST/PATCH/DELETE /admin/plans |
| `src/lib/adminClient.js` | Modificar | fetchAdminPlans, createAdminPlan, updateAdminPlan, deleteAdminPlan |
| `src/components/admin/PlansPage.jsx` | Criar | Tabela + modal de criação/edição |
| `src/components/shell/SidebarRail.jsx` | Modificar | Item "Planos" com Package |
| `src/App.jsx` | Modificar | Lazy import + rota admin-plans |
| `src/index.css` | Modificar | Classes admin-plans* |
| `src/components/admin/__tests__/PlansPage.test.jsx` | Criar | Testes |

---

## Task 1: Backend

- [ ] GET /admin/plans — lista com active_subscriptions_count
- [ ] POST /admin/plans — criar com validação (slug único)
- [ ] PATCH /admin/plans/:id — atualizar, bloquear desativar se tem subs ativas
- [ ] DELETE /admin/plans/:id — excluir, proteger Free, bloquear se tem subs

## Task 2: Frontend — adminClient.js

- [ ] 4 novas funções exportadas

## Task 3: PlansPage.jsx

- [ ] Tabela com busca
- [ ] Botão Novo Plano → modal criação
- [ ] Modal criação/edição com campos (nome, slug, preços, limites, ativo)
- [ ] Ações: editar, excluir com confirmação
- [ ] Loading/error/empty states

## Task 4: Sidebar + App.jsx

- [ ] Sidebar: item "Planos" com Package
- [ ] App.jsx: lazy import, tab, labels, renderContent

## Task 5: CSS

- [ ] Classes admin-plans, admin-plans-form, inputs estilizados

## Task 6: Testes

- [ ] PlansPage.test.jsx (loading, dados, empty, modal)

## Verificação Final

- [ ] `npm run lint` sem warnings
- [ ] `npm test` passando
- [ ] `npm run build` bem-sucedido
