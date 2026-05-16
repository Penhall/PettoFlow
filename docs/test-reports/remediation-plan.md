# Plano de Remediação — NexusCRM/PettoFlow

**Gerado em:** 2026-05-16  
**Base:** Relatórios de teste Fases 1–5 (docs/test-reports/)  
**Commits recentes:** `d21a579` (fix workspace-core OPTIONS)

---

## Itens Completados

| ID | Severidade | Descrição | Commit |
|----|-----------|-----------|--------|
| OP-01 | 🔴 Crítico | workspace-core OPTIONS retornava 503 BOOT_ERROR | `d21a579` |

---

## Issues Pendentes por Severidade

### 🟡 HIGH

#### H-01: Logout não invalida sessão Supabase
- **Fonte:** Fase 1, achado OP-02
- **Arquivo:** `src/context/AuthContext.jsx` (função `signOut`)
- **Problema:** O botão "Sair" no dropdown de perfil chama `supabase.auth.signOut()` mas a sessão persiste via cookie. Após logout e navegação para `/`, o app ainda reconhece o usuário.
- **Causa provável:** O cookie `sb-<ref>-auth-token` do Supabase não está sendo limpo, ou o `signOut()` não está invalidando a sessão no servidor corretamente.
- **Correção:** 
  1. Verificar se `signOut({ scope: 'local' })` vs `signOut({ scope: 'global' })` é adequado
  2. Após `signOut()`, limpar `localStorage.clear()` e `sessionStorage.clear()` como fallback
  3. Chamar `window.location.href = '/'` após limpeza para forçar re-render
- **Validação:** Fazer login → clicar Sair → verificar que a tela de login aparece sem sessão automática
- **Arquivos:** `src/context/AuthContext.jsx`, `src/App.jsx` (handleProfileSignOut)

#### H-02: Admin master sem tenant não acessa painéis admin
- **Fonte:** Fase 1, achado OP-03
- **Arquivo:** `src/App.jsx` (linha 761, `renderContent`)
- **Problema:** Quando `bootstrapError` é verdadeiro (usuário admin master sem tenant), o `renderContent` retorna um EmptyState que substitui COMPLETAMENTE o conteúdo do `main`. Os painéis admin (Diagnósticos, Espaços, etc.) existem na sidebar e as rotas hash estão registradas, mas o bootstrap error bloqueia a renderização.
- **Correção:** Modificar `renderContent` para verificar se a rota ativa é uma rota admin ANTES de renderizar o bootstrap error. Algo como:
  ```
  if (bootstrapError && !isAdminRoute(activeTab)) {
    return <EmptyState ... />
  }
  // se for rota admin, renderiza conteúdo normalmente
  ```
- **Validação:** Logar como admin sem tenant → navegar para Diagnósticos → ver painel carregar
- **Arquivos:** `src/App.jsx`

#### H-03: Navegação SPA por hash não funcional via a11y tree
- **Fonte:** Fase 2, TU-03
- **Arquivo:** `src/App.jsx` (hash routing logic)
- **Problema:** A navegação por hash (`window.location.hash`) não aciona `renderContent` mesmo com o hash correto. Isso sugere que o listener de hashchange não está sendo chamado, ou o estado `activeTab` não está sincronizado com o hash.
- **Correção:** Adicionar um `useEffect` que escuta `hashchange` e sincroniza `activeTab` com o hash atual:
  ```js
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.slice(1) || 'dashboard'
      if (VALID_TABS.has(hash) || ADMIN_TABS.has(hash)) {
        setActiveTab(hash)
      }
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  ```
- **Validação:** Navegar diretamente para `#admin-diagnostics` → ver painel carregar. Clicar em "Diagnósticos" na sidebar → ver painel carregar.
- **Arquivos:** `src/App.jsx`

---

### 🟡 MEDIUM

#### M-01: 7 feature flags não wired
- **Fonte:** Fase 2, TU-02
- **Arquivo:** `src/lib/featureFlags.js`
- **Problema:** Flags `guided_tour_enabled`, `command_favorites`, `telegram_compact_mode`, `dev_tools`, `batch_operations`, `calendar_view`, `advanced_filters` existem no sistema de flags mas não estão conectadas a nenhum componente.
- **Correção:** Priorizar wiring por impacto:
  1. `guided_tour_enabled` → TourProvider/onboarding flow
  2. `batch_operations` → Tela de tarefas (seleção múltipla)
  3. `calendar_view` → Calendário de tarefas
  4. Demais: postergar para próxima fase de features
- **Validação:** Alternar flag no DiagnosticsPanel → ver UI mudar
- **Arquivos:** Múltiplos componentes

#### M-02: Seções Atividades/Finanças/Arquivo sem dados seed
- **Fonte:** Fase 2, TU-04
- **Problema:** As seções de Atividades, Finanças e Arquivo carregam estrutura mas exibem dados vazios. O tenant Central tem apenas dados seed de tasks, team e clients.
- **Correção:** Adicionar seed data para atividades, transações financeiras e tarefas arquivadas no tenant Central.
- **Onde:** Supabase seed SQL ou script de inicialização
- **Validação:** Navegar para cada seção → ver dados populados

#### M-03: Admin panels não testados via browser
- **Fonte:** Fase 2, seção admin
- **Problema:** Os 5 painéis admin (Dashboard, Espaços, Auditoria, Planos, Diagnósticos) não puderam ser testados devido a limitação de navegação SPA via a11y tree.
- **Correção:** Após corrigir H-03, testar cada painel:
  1. Verificar se carregam com dados reais
  2. Verificar permissões (tester vs admin vs support)
  3. Verificar CRUD em Espaços e Planos
- **Validação:** Acesso administrador funcional

---

### 🟢 LOW

#### L-01: Telegram requer token do bot para teste funcional
- **Fonte:** Fase 5
- **Problema:** As 3 Edge Functions do Telegram estão deployadas mas não podem ser testadas sem um token de bot do BotFather e webhook configurado.
- **Ação:** Criar bot no BotFather, configurar env vars no Supabase, setar webhook
- **Arquivos:** Configuração, não código

#### L-02: Testes do Codex reformataram _shared/*.ts sem intenção
- **Fonte:** Durante correção do workspace-core
- **Problema:** Codex converteu TypeScript para JavaScript puro em 6 arquivos `_shared/*.ts`. As alterações foram revertidas via `git checkout`.
- **Ação:** Nenhuma (já resolvido)

---

## Plano de Implementação por Fase

### Fase A: Navegação e Login (Prioridade Máxima)
| Item | Esforço | Depende |
|------|---------|---------|
| A-1: H-01 — Fix logout session | 1h | — |
| A-2: H-03 — Fix hash routing sync | 2h | — |
| A-3: H-02 — Admin sem tenant render | 3h | A-2 |

### Fase B: Feature Flags e Dados
| Item | Esforço | Depende |
|------|---------|---------|
| B-1: M-01 — Wire 3 flags prioritárias | 4h | — |
| B-2: M-02 — Seed data Atividades/Finanças | 2h | — |

### Fase C: Testes de Admin e Telegram
| Item | Esforço | Depende |
|------|---------|---------|
| C-1: M-03 — Testar admin panels | 2h | A-2, A-3 |
| C-2: L-01 — Configurar Telegram bot | 2h | — |

### Fase D: Rollout Controlado
| Item | Esforço | Depende |
|------|---------|---------|
| D-1: Ativar feature flags progressivamente | 1h | B-1 |
| D-2: Monitorar telemetria via DiagnosticsPanel | Contínuo | A-3 |
| D-3: Convidar usuários reais | 1h | Todas |

---

## Resumo

| Prioridade | Itens | Esforço Total |
|-----------|-------|--------------|
| 🔴 Fase A (Navegação) | 3 issues | ~6h |
| 🟡 Fase B (Flags + Dados) | 2 issues | ~6h |
| 🟢 Fase C (Testes + Telegram) | 2 issues | ~4h |
| ⚪ Fase D (Rollout) | 3 itens | ~2h + contínuo |

**Total estimado:** ~18h de implementação  
**Dependências:** Fase A → Fase B → Fase C → Fase D (sequencial)
