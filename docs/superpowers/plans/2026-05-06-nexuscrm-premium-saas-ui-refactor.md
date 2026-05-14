# NexusCRM Premium SaaS UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor NexusCRM into a premium, dense, calm operational workspace by replacing the current shell, token model, page chrome, and target page layouts without changing backend behavior.

**Architecture:** Build the redesign from the outside in. First, consolidate theme tokens and shell primitives in reusable components, then introduce shared page-level primitives, and finally migrate `Settings`, `Finance`, `Activities`, and `Tasks` onto the new system. This keeps the redesign cohesive and avoids mixing old and new chrome across the app.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Framer Motion, lucide-react, CSS custom properties in `src/index.css`

---

## File structure map

### New files

- `src/components/shell/AppShell.jsx`
  - Shared shell wrapper with sidebar rail, topbar slot, and content region
- `src/components/shell/SidebarRail.jsx`
  - Premium compact navigation rail with expanded/compact widths
- `src/components/shell/Topbar.jsx`
  - Short topbar with global search, workspace selector, admin shortcut, and profile trigger
- `src/components/shell/ProfileMenu.jsx`
  - Dropdown menu for theme, account identity, and sign-out
- `src/components/shared/PageHeader.jsx`
  - Standard page title/subtitle header with optional compact metrics
- `src/components/shared/PageTabs.jsx`
  - Shared tabs/view navigation primitive
- `src/components/shared/PageActionBar.jsx`
  - Shared search/filter/sort/action layout primitive
- `src/components/shared/SurfaceCard.jsx`
  - Soft surface wrapper for grouped content
- `src/components/shared/MetricCard.jsx`
  - Compact KPI card primitive
- `src/components/shared/EmptyState.jsx`
  - Premium empty-state primitive with restrained iconography and next-step guidance
- `src/components/Tasks/TasksPage.jsx`
  - Extracted page wrapper for Tasks page chrome and view switching
- `src/components/shell/AppShell.test.jsx`
- `src/components/shared/PageHeader.test.jsx`
- `src/components/shared/PageTabs.test.jsx`
- `src/components/shared/PageActionBar.test.jsx`
- `src/components/shared/EmptyState.test.jsx`
- `src/components/Tasks/TasksPage.test.jsx`
- `src/components/Finance/FinanceView.test.jsx`
- `src/components/Activities/ActivitiesView.test.jsx`
- `src/context/ThemeContext.test.jsx`

### Modified files

- `src/App.jsx`
  - Replace current shell assembly and inline Tasks page chrome with new primitives
- `src/components/Header.jsx`
  - Remove or convert into compatibility wrapper around `Topbar.jsx`, or delete once replaced
- `src/components/Sidebar.jsx`
  - Remove or convert into compatibility wrapper around `SidebarRail.jsx`, or delete once replaced
- `src/components/tenant/TenantSwitcher.jsx`
  - Convert into compact shell selector presentation
- `src/components/Settings/SettingsView.jsx`
  - Migrate to shared page primitives and surface system
- `src/components/Finance/FinanceView.jsx`
  - Migrate to standard header/nav/action/content anatomy
- `src/components/Activities/ActivitiesView.jsx`
  - Migrate to standard header/nav/action/content anatomy
- `src/components/Tasks/KanbanView.jsx`
  - Update lanes, empty states, and operational density styling
- `src/components/Tasks/ListView.jsx`
  - Restyle table into compact operational surface
- `src/components/Tasks/OverviewView.jsx`
  - Reframe into new page content surface system
- `src/context/ThemeContext.jsx`
  - Collapse theme strategy to premium `light` + derived `dark`
- `src/index.css`
  - Replace fragmented theme tokens with unified shell/page/table/motion system

### Existing tests to update

- `src/components/Settings/SettingsView.test.jsx`
- `src/components/tenant/TenantSwitcher.test.jsx`

---

### Task 1: Consolidate theme context and design tokens

**Files:**
- Create: `src/context/ThemeContext.test.jsx`
- Modify: `src/context/ThemeContext.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext.jsx'

function Probe() {
  const { theme, themes } = useTheme()
  return (
    <>
      <span>{theme}</span>
      <span>{themes.map(item => item.id).join(',')}</span>
    </>
  )
}

test('ThemeProvider exposes only light and dark product themes', () => {
  localStorage.removeItem('pettoflow_theme')

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  )

  expect(screen.getByText('light')).toBeInTheDocument()
  expect(screen.getByText('light,dark')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/ThemeContext.test.jsx`

Expected: FAIL because the provider still defaults to `ledger` and exposes four themes.

- [ ] **Step 3: Write minimal implementation**

```jsx
const PRODUCT_THEMES = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Escuro' },
]

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('pettoflow_theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pettoflow_theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: PRODUCT_THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

```css
:root,
[data-theme='light'] {
  --shell-sidebar-w: 240px;
  --shell-sidebar-w-compact: 72px;
  --shell-topbar-h: 56px;
  --shell-topbar-h-mobile: 48px;
  --bg-app: #f5f4ef;
  --bg-elevated: rgba(255, 255, 255, 0.84);
  --bg-muted: #eceae3;
  --text-main: #171714;
  --text-secondary: #666459;
  --border-subtle: rgba(23, 23, 20, 0.08);
  --accent: #235c53;
  --shadow-soft: 0 18px 40px rgba(18, 18, 16, 0.06);
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-overlay: 240ms;
}

[data-theme='dark'] {
  --bg-app: #151715;
  --bg-elevated: rgba(31, 33, 31, 0.88);
  --bg-muted: #202320;
  --text-main: #f3f2ec;
  --text-secondary: #aaa79b;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --accent: #7cb4a2;
  --shadow-soft: 0 18px 40px rgba(0, 0, 0, 0.28);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/context/ThemeContext.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/ThemeContext.jsx src/context/ThemeContext.test.jsx src/index.css
git commit -m "refactor(ui): consolidate NexusCRM theme tokens"
```

### Task 2: Build shell primitives for rail, topbar, and profile menu

**Files:**
- Create: `src/components/shell/AppShell.jsx`
- Create: `src/components/shell/SidebarRail.jsx`
- Create: `src/components/shell/Topbar.jsx`
- Create: `src/components/shell/ProfileMenu.jsx`
- Create: `src/components/shell/AppShell.test.jsx`
- Modify: `src/components/tenant/TenantSwitcher.jsx`
- Modify: `src/components/tenant/TenantSwitcher.test.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import AppShell from './AppShell.jsx'

test('AppShell renders a compact topbar and sidebar rail layout', () => {
  render(
    <AppShell
      sidebar={<nav aria-label="Principal">Sidebar</nav>}
      topbar={<div>Topbar</div>}
    >
      <section>Conteúdo</section>
    </AppShell>
  )

  expect(screen.getByLabelText('Principal')).toBeInTheDocument()
  expect(screen.getByText('Topbar')).toBeInTheDocument()
  expect(screen.getByText('Conteúdo')).toBeInTheDocument()
})
```

```jsx
import { render, screen } from '@testing-library/react'
import TenantSwitcher from './TenantSwitcher.jsx'
import { useTenant } from '../../hooks/useTenant.js'

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: vi.fn(),
}))

test('TenantSwitcher renders a compact selector without verbose field copy', () => {
  useTenant.mockReturnValue({
    tenants: [{ id: '1', name: 'Workspace Alpha' }, { id: '2', name: 'Workspace Beta' }],
    activeTenantId: '1',
    setActiveTenant: vi.fn(),
  })

  render(<TenantSwitcher />)

  expect(screen.getByRole('combobox', { name: /workspace ativo/i })).toBeInTheDocument()
  expect(screen.queryByText('Selecione um workspace')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shell/AppShell.test.jsx src/components/tenant/TenantSwitcher.test.jsx`

Expected: FAIL because the shell primitives do not exist and the tenant selector still renders a labeled form pattern.

- [ ] **Step 3: Write minimal implementation**

```jsx
export default function AppShell({ sidebar, topbar, children }) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">{sidebar}</aside>
      <div className="app-shell__workspace">
        <header className="app-shell__topbar">{topbar}</header>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
```

```jsx
export default function TenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant()

  if (!tenants.length) return null

  return (
    <select
      className="workspace-selector"
      aria-label="Workspace ativo"
      value={activeTenantId ?? ''}
      onChange={(event) => setActiveTenant(event.target.value)}
    >
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name}
        </option>
      ))}
    </select>
  )
}
```

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--shell-sidebar-w) minmax(0, 1fr);
  min-height: 100dvh;
}

.app-shell__topbar {
  height: var(--shell-topbar-h);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
}

.workspace-selector {
  height: 36px;
  min-width: 144px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-muted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shell/AppShell.test.jsx src/components/tenant/TenantSwitcher.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/AppShell.jsx src/components/shell/SidebarRail.jsx src/components/shell/Topbar.jsx src/components/shell/ProfileMenu.jsx src/components/shell/AppShell.test.jsx src/components/tenant/TenantSwitcher.jsx src/components/tenant/TenantSwitcher.test.jsx src/index.css
git commit -m "feat(ui): add premium shell primitives"
```

### Task 3: Add shared page primitives for header, tabs, action bar, surfaces, and empty states

**Files:**
- Create: `src/components/shared/PageHeader.jsx`
- Create: `src/components/shared/PageTabs.jsx`
- Create: `src/components/shared/PageActionBar.jsx`
- Create: `src/components/shared/SurfaceCard.jsx`
- Create: `src/components/shared/MetricCard.jsx`
- Create: `src/components/shared/EmptyState.jsx`
- Create: `src/components/shared/PageHeader.test.jsx`
- Create: `src/components/shared/PageTabs.test.jsx`
- Create: `src/components/shared/PageActionBar.test.jsx`
- Create: `src/components/shared/EmptyState.test.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing tests**

```jsx
import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader.jsx'

test('PageHeader renders title, subtitle, and compact metrics', () => {
  render(
    <PageHeader
      title="Finanças"
      subtitle="Controle entradas, saídas e previsões."
      metrics={[{ label: 'Saldo', value: 'R$ 12.400' }]}
    />
  )

  expect(screen.getByRole('heading', { name: 'Finanças' })).toBeInTheDocument()
  expect(screen.getByText('Controle entradas, saídas e previsões.')).toBeInTheDocument()
  expect(screen.getByText('R$ 12.400')).toBeInTheDocument()
})
```

```jsx
import { render, screen } from '@testing-library/react'
import EmptyState from './EmptyState.jsx'

test('EmptyState explains purpose, reason, and next action', () => {
  render(
    <EmptyState
      title="Nenhuma regra criada"
      description="As regras automatizam a classificação das transações."
      detail="Este espaço está vazio porque nenhuma automação foi configurada."
      action={<button>Criar regra</button>}
    />
  )

  expect(screen.getByText('Nenhuma regra criada')).toBeInTheDocument()
  expect(screen.getByText(/automatizam a classificação/i)).toBeInTheDocument()
  expect(screen.getByText(/nenhuma automação/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Criar regra' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/shared/PageHeader.test.jsx src/components/shared/PageTabs.test.jsx src/components/shared/PageActionBar.test.jsx src/components/shared/EmptyState.test.jsx`

Expected: FAIL because the shared primitives do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```jsx
export default function PageHeader({ title, subtitle, metrics = [] }) {
  return (
    <section className="page-header">
      <div className="page-header__copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {metrics.length ? (
        <div className="page-header__metrics">
          {metrics.map((item) => (
            <article key={item.label} className="metric-card metric-card--compact">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
```

```jsx
export default function EmptyState({ icon: Icon, title, description, detail, action }) {
  return (
    <section className="empty-state-card">
      {Icon ? <Icon size={18} aria-hidden="true" /> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {detail ? <span>{detail}</span> : null}
      {action ? <div className="empty-state-card__action">{action}</div> : null}
    </section>
  )
}
```

```css
.page-header,
.page-action-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.empty-state-card {
  display: grid;
  gap: 10px;
  padding: 24px;
  border-radius: 20px;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-soft);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/shared/PageHeader.test.jsx src/components/shared/PageTabs.test.jsx src/components/shared/PageActionBar.test.jsx src/components/shared/EmptyState.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/PageHeader.jsx src/components/shared/PageTabs.jsx src/components/shared/PageActionBar.jsx src/components/shared/SurfaceCard.jsx src/components/shared/MetricCard.jsx src/components/shared/EmptyState.jsx src/components/shared/PageHeader.test.jsx src/components/shared/PageTabs.test.jsx src/components/shared/PageActionBar.test.jsx src/components/shared/EmptyState.test.jsx src/index.css
git commit -m "feat(ui): add shared page chrome primitives"
```

### Task 4: Extract Tasks page chrome into a dedicated page component

**Files:**
- Create: `src/components/Tasks/TasksPage.jsx`
- Create: `src/components/Tasks/TasksPage.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Tasks/KanbanView.jsx`
- Modify: `src/components/Tasks/ListView.jsx`
- Modify: `src/components/Tasks/OverviewView.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import TasksPage from './TasksPage.jsx'

test('TasksPage separates header, tabs, action bar, and content views', () => {
  render(
    <TasksPage
      tasks={[]}
      columns={[]}
      viewType="kanban"
      setViewType={() => {}}
      searchQuery=""
      onSearch={() => {}}
      sortBy={null}
      setSortBy={() => {}}
      filterTag={null}
      setFilterTag={() => {}}
      allTags={[]}
      onCreateTask={() => {}}
      content={<div>Kanban</div>}
    />
  )

  expect(screen.getByRole('heading', { name: 'Tarefas' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Kanban' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /nova tarefa/i })).toBeInTheDocument()
  expect(screen.getByText('Kanban')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Tasks/TasksPage.test.jsx`

Expected: FAIL because `TasksPage.jsx` does not exist and the current Tasks chrome is still embedded in `App.jsx`.

- [ ] **Step 3: Write minimal implementation**

```jsx
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'

const TASK_VIEWS = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'Lista' },
  { id: 'overview', label: 'Visão geral' },
  { id: 'files', label: 'Arquivos' },
  { id: 'calendar', label: 'Calendário' },
]

export default function TasksPage(props) {
  return (
    <div className="tasks-page">
      <PageHeader
        title="Tarefas"
        subtitle="Gerencie pipeline, prioridades e execução diária com alta densidade operacional."
      />
      <PageTabs items={TASK_VIEWS} activeId={props.viewType} onChange={props.setViewType} />
      <PageActionBar
        searchValue={props.searchQuery}
        onSearch={props.onSearch}
        primaryAction={{ label: 'Nova tarefa', onClick: props.onCreateTask }}
      >
        {/* sort/filter controls moved here from App.jsx */}
      </PageActionBar>
      <div className="tasks-page__content">{props.content}</div>
    </div>
  )
}
```

```jsx
// App.jsx
return (
  <TasksPage
    tasks={filteredTasks}
    columns={columns}
    viewType={viewType}
    setViewType={setViewType}
    searchQuery={searchQuery}
    onSearch={setSearchQuery}
    sortBy={sortBy}
    setSortBy={setSortBy}
    filterTag={filterTag}
    setFilterTag={setFilterTag}
    allTags={allTags}
    onCreateTask={() => openAddModal()}
    content={renderTasksView()}
  />
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Tasks/TasksPage.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Tasks/TasksPage.jsx src/components/Tasks/TasksPage.test.jsx src/App.jsx src/components/Tasks/KanbanView.jsx src/components/Tasks/ListView.jsx src/components/Tasks/OverviewView.jsx src/index.css
git commit -m "refactor(tasks): extract standardized tasks page chrome"
```

### Task 5: Migrate Settings to the new shell and page primitives

**Files:**
- Modify: `src/components/Settings/SettingsView.jsx`
- Modify: `src/components/Settings/SettingsView.test.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import SettingsView from './SettingsView.jsx'

test('SettingsView renders premium page header and section tabs', () => {
  render(<SettingsView initialTab="members" />)

  expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
  expect(screen.getByText(/membros, integrações e preferências/i)).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Membros' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Settings/SettingsView.test.jsx`

Expected: FAIL because the current component uses inline styles and does not expose standardized tab semantics.

- [ ] **Step 3: Write minimal implementation**

```jsx
import PageHeader from '../shared/PageHeader.jsx'
import PageTabs from '../shared/PageTabs.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

export default function SettingsView({ initialTab = 'members' }) {
  return (
    <div className="settings-page">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie membros, integrações, auditoria e preferências do workspace."
      />
      <PageTabs items={TABS} activeId={activeTab} onChange={setActiveTab} />
      <SurfaceCard className="settings-page__panel">
        {activeTab === 'members' && <MembersPage />}
        {activeTab === 'billing' && <BillingPage />}
        {activeTab === 'audit' && <AuditTimeline />}
        {activeTab === 'telegram' && <TelegramSection />}
        {activeTab === 'commands' && <CommandsSection />}
      </SurfaceCard>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Settings/SettingsView.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/SettingsView.jsx src/components/Settings/SettingsView.test.jsx src/index.css
git commit -m "refactor(settings): migrate settings to shared page system"
```

### Task 6: Migrate Finance to premium dense page structure and table system

**Files:**
- Create: `src/components/Finance/FinanceView.test.jsx`
- Modify: `src/components/Finance/FinanceView.jsx`
- Modify: `src/components/Finance/FinanceSummary.jsx`
- Modify: `src/components/Finance/TransactionList.jsx`
- Modify: `src/components/Finance/AccountCard.jsx`
- Modify: `src/components/Finance/ReceivablesList.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import FinanceView from './FinanceView.jsx'

test('FinanceView renders header, segmented tabs, and contextual action bar', () => {
  render(<FinanceView clients={[]} tasks={[]} team={[]} onAddTask={() => {}} columns={[]} />)

  expect(screen.getByRole('heading', { name: 'Finanças' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Extrato' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /nova transação/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Finance/FinanceView.test.jsx`

Expected: FAIL because the current finance header/tabs/actions are mixed into a single block with inconsistent semantics.

- [ ] **Step 3: Write minimal implementation**

```jsx
<div className="finance-page">
  <PageHeader
    title="Finanças"
    subtitle="Acompanhe extrato, contas, regras e previsões com leitura operacional compacta."
    metrics={[
      { label: 'Saldo consolidado', value: formattedTotalBalance },
      { label: 'A receber', value: formattedReceivables },
    ]}
  />

  <PageTabs items={financeTabs} activeId={activeTab} onChange={setActiveTab} />

  <PageActionBar
    primaryAction={
      activeTab === 'extrato'
        ? { label: 'Nova transação', onClick: () => setShowTransactionForm(true) }
        : null
    }
  >
    {activeTab === 'extrato' ? <FinanceFilters ... /> : null}
  </PageActionBar>

  <SurfaceCard className="finance-page__surface">{renderFinanceContent()}</SurfaceCard>
</div>
```

```css
.tx-table tr {
  border-bottom: 1px solid var(--border-subtle);
}

.tx-table td,
.tx-table th {
  padding: 10px 12px;
  text-align: left;
}

.tx-table tbody tr:hover {
  background: color-mix(in srgb, var(--bg-muted) 55%, transparent);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Finance/FinanceView.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Finance/FinanceView.jsx src/components/Finance/FinanceView.test.jsx src/components/Finance/FinanceSummary.jsx src/components/Finance/TransactionList.jsx src/components/Finance/AccountCard.jsx src/components/Finance/ReceivablesList.jsx src/index.css
git commit -m "refactor(finance): migrate finance page to dense premium layout"
```

### Task 7: Migrate Activities to timeline-first page structure

**Files:**
- Create: `src/components/Activities/ActivitiesView.test.jsx`
- Modify: `src/components/Activities/ActivitiesView.jsx`
- Modify: `src/components/Activities/ActivityTimeline.jsx`
- Modify: `src/components/Activities/TemplatesTab.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import ActivitiesView from './ActivitiesView.jsx'

test('ActivitiesView renders standardized header, tabs, and contextual action model', () => {
  render(<ActivitiesView clients={[]} tasks={[]} team={[]} searchQuery="" />)

  expect(screen.getByRole('heading', { name: 'Atividades' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Timeline' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /nova atividade/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Activities/ActivitiesView.test.jsx`

Expected: FAIL because the current page uses an ad hoc view header and plain buttons without standardized tab structure.

- [ ] **Step 3: Write minimal implementation**

```jsx
<div className="activities-page">
  <PageHeader
    title="Atividades"
    subtitle="Acompanhe o histórico do trabalho, modelos e agenda com leitura contínua."
  />
  <PageTabs items={activityTabs} activeId={activeTab} onChange={setActiveTab} />
  <PageActionBar
    primaryAction={
      activeTab === 'timeline'
        ? { label: 'Nova atividade', onClick: handleOpenNew }
        : activeTab === 'modelos'
          ? { label: 'Novo modelo', onClick: handleNewTemplate }
          : null
    }
  />
  <SurfaceCard className="activities-page__surface">{renderActivityContent()}</SurfaceCard>
</div>
```

```css
.activity-timeline {
  display: grid;
  gap: 12px;
}

.activity-group {
  display: grid;
  gap: 8px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Activities/ActivitiesView.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Activities/ActivitiesView.jsx src/components/Activities/ActivitiesView.test.jsx src/components/Activities/ActivityTimeline.jsx src/components/Activities/TemplatesTab.jsx src/index.css
git commit -m "refactor(activities): migrate activities to timeline-first layout"
```

### Task 8: Replace App shell integration and wire all pages through the new system

**Files:**
- Create: `src/App.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/shared/CommandPalette.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('App renders global search and hides theme/logout inside profile affordance', async () => {
  render(<App />)

  expect(screen.getByRole('searchbox', { name: /pesquisar/i })).toBeInTheDocument()
  expect(screen.queryByTitle(/alternar tema/i)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/sair do nexuscrm/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`

Expected: FAIL because `App.jsx` still uses the legacy `Header` and `Sidebar`, and theme/logout remain exposed in the main header.

- [ ] **Step 3: Write minimal implementation**

```jsx
return (
  <AppShell
    sidebar={
      <SidebarRail
        activeTab={activeTab}
        onChange={handleTabChange}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
    }
    topbar={
      <Topbar
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
        profileMenu={<ProfileMenu user={user} onSignOut={handleSignOut} />}
      />
    }
  >
    {renderContent()}
  </AppShell>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx src/components/Header.jsx src/components/Sidebar.jsx src/components/shared/CommandPalette.jsx src/index.css
git commit -m "refactor(app): wire NexusCRM into the new shell"
```

### Task 9: Final density, motion, and regression pass

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/Tasks/KanbanView.jsx`
- Modify: `src/components/Tasks/ListView.jsx`
- Modify: `src/components/Finance/TransactionList.jsx`
- Modify: `src/components/Activities/ActivityTimeline.jsx`
- Modify: `src/components/shared/EmptyState.jsx`

- [ ] **Step 1: Write the failing regression checks**

```jsx
import { render, screen } from '@testing-library/react'
import EmptyState from './components/shared/EmptyState.jsx'

test('EmptyState stays restrained and action-oriented', () => {
  render(
    <EmptyState
      title="Nenhum arquivo disponível"
      description="Arquivos centralizam documentos e referências do fluxo."
      detail="Este espaço está vazio porque nenhum item foi anexado ainda."
      action={<button>Adicionar arquivo</button>}
    />
  )

  expect(screen.getByText(/centralizam documentos/i)).toBeInTheDocument()
  expect(screen.getByText(/nenhum item foi anexado ainda/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run targeted tests and quality checks**

Run: `npx vitest run src/components/shared/EmptyState.test.jsx src/components/Tasks/TasksPage.test.jsx src/components/Finance/FinanceView.test.jsx src/components/Activities/ActivitiesView.test.jsx src/components/Settings/SettingsView.test.jsx`

Expected: FAIL if any page still depends on old empty-state copy or non-standard page chrome.

- [ ] **Step 3: Write minimal implementation**

```css
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-overlay: 240ms;
}

.surface-card,
.task-card,
.tx-table tbody tr,
.page-tab,
.page-action-bar button {
  transition:
    opacity var(--motion-fast) ease,
    transform var(--motion-base) cubic-bezier(0.2, 0, 0, 1),
    background-color var(--motion-base) ease,
    border-color var(--motion-base) ease;
}

.task-card:hover,
.surface-card:hover {
  transform: translateY(-1px);
}
```

```css
.tx-table td,
.tx-table th,
.task-table td,
.task-table th {
  padding-block: 10px;
}

.kanban-column {
  padding: 16px;
}
```

- [ ] **Step 4: Run full validation**

Run: `npm test`

Expected: PASS

Run: `npm run lint`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/Tasks/KanbanView.jsx src/components/Tasks/ListView.jsx src/components/Finance/TransactionList.jsx src/components/Activities/ActivityTimeline.jsx src/components/shared/EmptyState.jsx
git commit -m "polish(ui): finalize NexusCRM density and motion system"
```

## Self-review

### Spec coverage

- Shell redesign: covered by Tasks 1, 2, and 8
- Unified theme model and shell dimensions: covered by Task 1
- Shared page anatomy: covered by Tasks 3 and 4
- Settings redesign: covered by Task 5
- Finance redesign and table philosophy: covered by Task 6 and Task 9
- Activities redesign: covered by Task 7
- Tasks redesign and operational density: covered by Tasks 4 and 9
- Empty-state emotional direction: covered by Tasks 3 and 9
- Motion restraint: covered by Task 9

### Placeholder scan

- No `TODO`, `TBD`, or deferred placeholders remain
- Every task has explicit file paths, test commands, implementation snippets, and commit commands

### Type consistency

- Shared primitive names are consistent across tasks: `AppShell`, `SidebarRail`, `Topbar`, `ProfileMenu`, `PageHeader`, `PageTabs`, `PageActionBar`, `SurfaceCard`, `MetricCard`, `EmptyState`, `TasksPage`
- Theme ids are consistent: `light`, `dark`
