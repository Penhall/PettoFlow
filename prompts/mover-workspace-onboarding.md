# Mover "Criar espaço de trabalho" para Settings

## Contexto

Atualmente, o `TenantGate` trava o usuário que NÃO tem workspace — ele só vê a tela `WorkspaceOnboarding` e não consegue acessar o app. O objetivo é:

1. **Remover o bloqueio** — usuário sem workspace entra no app (dashboard vazio com CTA)
2. **Mover o formulário** de criação de workspace para uma aba "Workspace" em Settings
3. **Dashboard** deve mostrar empty state com CTA para criar workspace
4. **Settings** ganha uma aba "Workspace" que mostra o formulário

## Stack

- React + Vite + ES modules
- Indentação 2 espaços, aspas simples
- Já usa `lucide-react` para ícones
- CSS com variáveis no padrão existente: `auth-shell`, `auth-card`, `auth-form`, etc. para o modo standalone; classes do Settings para modo embed

## Arquivos para modificar

### 1. `src/components/tenant/TenantGate.jsx`

**O que fazer:** Remover o bloqueio de usuários sem tenant. Remover o import de `WorkspaceOnboarding`. O componente passa a SEMPRE renderizar `children`.

**ANTES:**
```jsx
import WorkspaceOnboarding from './WorkspaceOnboarding.jsx'
...
if (!hasTenant) {
  return <WorkspaceOnboarding />
}
```

**DEPOIS:** Remove o import de WorkspaceOnboarding. Remove o bloco `if (!hasTenant)`. O componente só renderiza `children`. Mantém os estados de loading e error.

### 2. `src/components/tenant/WorkspaceOnboarding.jsx`

**O que fazer:** Adicionar suporte a `embed` prop. Quando `embed=true`, não renderiza o wrapper `auth-shell`/`auth-card` — renderiza só o formulário e o texto descritivo, sem as classes de página cheia.

**Mudanças:**
- Aceitar `{ embed = false }` como prop
- Quando `embed=false` (default): comportamento atual (auth-shell + auth-card)
- Quando `embed=true`: renderizar apenas o conteúdo do formulário (sem auth-shell wrapper, sem auth-card, sem auth-copy/eyebrow)
- O título "Criar seu espaço de trabalho" vira `<h2>` em vez de `<h1>` quando embed
- A descrição pode ser opcional em embed (ou mantida como `<p>`)

### 3. `src/components/Settings/SettingsView.jsx`

**O que fazer:** Adicionar aba "Workspace" com o formulário de criação.

**Mudanças:**
- Importar `WorkspaceOnboarding` de `../tenant/WorkspaceOnboarding.jsx`
- Importar `useTenant` de `../../hooks/useTenant.js`
- Adicionar tab `{ id: 'workspace', label: 'Workspace' }` no array TABS (antes de 'members' para ficar primeiro)
- Adicionar no render condicional: `{activeTab === 'workspace' && <WorkspaceOnboarding embed />}`

### 4. `src/components/Dashboard/Dashboard.jsx`

**O que fazer:** Adicionar prop `onCreateWorkspace`. Quando essa prop está presente, o Dashboard mostra um empty state de boas-vindas em vez do dashboard normal.

**Mudanças:**
- Aceitar prop `onCreateWorkspace` (function)
- Quando `tasks.length === 0 && onCreateWorkspace`: mostrar empty state de "Bem-vindo ao NexusCRM" com CTA "Criar espaço de trabalho"
- Não precisa tocar no empty state existente para `tasks.length === 0` sem `onCreateWorkspace` — manter o comportamento atual para usuários com workspace mas sem tarefas

**Detalhe do empty state:**
```jsx
<SurfaceCard className=\"dashboard-page__empty\">
  <EmptyState
    title=\"Bem-vindo ao NexusCRM\"
    description=\"Para começar, crie seu primeiro espaço de trabalho. É onde você organizará clientes, tarefas, atividades e finanças.\"
    detail=\"Depois de criar, você pode convidar sua equipe e configurar integrações.\"
    quickActions={[
      {
        id: 'create-first-workspace',
        label: 'Criar espaço de trabalho',
        onClick: onCreateWorkspace,
      },
    ]}
  />
</SurfaceCard>
```

Note: EmptyState pode ou não ter `quickActions` prop. Verifique o componente EmptyState (`src/components/shared/EmptyState.jsx`) para ver se suporta quickActions. Se não suportar, use um botão simples dentro de um div extra no dashboard.

### 5. `src/App.jsx`

**O que fazer:** Detectar quando usuário não tem workspace e mostrar empty state no Dashboard + navegar para Settings > Workspace.

**Mudanças:**

**a)** No topo, importar useEffect e useState (já importados na linha 1).

**b)** Adicionar estado `workspaceRequired` e `pendingSettingsTab`:
```jsx
const { activeTenantId } = useTenant()  // já existe
const [pendingSettingsTab, setPendingSettingsTab] = useState(null)
```

**c)** Variável derivada:
```jsx
const noActiveWorkspace = !activeTenantId && !loading
```

**d)** No render de `case 'dashboard'`, passar o novo prop:
```jsx
case 'dashboard':
  return (
    <Dashboard
      tasks={tasks}
      columns={columns}
      onboardingPanel={...}
      onCreateWorkspace={noActiveWorkspace ? () => {
        setPendingSettingsTab('workspace')
        handleTabChange('settings')
      } : undefined}
    />
  )
```

**e)** No render de `case 'settings'`, passar `initialTab` dinâmico:
```jsx
case 'settings':
  return (
    <SettingsView
      initialTab={pendingSettingsTab || initialSettingsTab}
      ...
    />
  )
```

**f)** No `handleTabChange`, quando sair de 'settings', limpar `pendingSettingsTab`:
```jsx
const handleTabChange = (tab) => {
  if (tab !== 'settings') {
    setPendingSettingsTab(null)
  }
  startTransition(() => {
    ...
  })
}
```

### 6. Testes

**`src/components/tenant/TenantGate.test.jsx`**: Remover ou atualizar o test `mostra onboarding quando o usuario autenticado nao possui tenant ativo` — esse comportamento não existe mais. O test deve verificar que, com `hasTenant: false`, os children SÃO renderizados.

## Regras

- ES modules, indentação 2 espaços, aspas simples
- Não adicionar novas dependências
- Usar os mesmos padrões de CSS existentes (variáveis `--color-*`, classes de layout)
- Manter compatibilidade com os testes existentes (atualizar apenas o que mudar de comportamento)
- Não quebrar o fluxo de login/auth
- WorkspaceOnboarding em modo embed deve funcionar visualmente dentro do card de Settings
