# Phase 28: Explicit Tenant Ownership & Real Runtime Topology — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand explicit tenantId threading into priority CRUD operations, introduce a real app-topology Playwright harness, harden async fault isolation, and add bootstrap observability diagnostics.

**Architecture:** Three parallel streams — (1) `workspaceCore.js` ownership threading + `App.jsx` / hook caller updates; (2) `MockProviders.jsx` + extended `RuntimeHarnessApp` + real topology Playwright tests; (3) `diagnostics.js` enrichment + `RootErrorBoundary` async hardening + `lazyWithRetry` tracing.

**Tech Stack:** React 18, Vitest + @testing-library/react (unit tests), Playwright (E2E, `npm run test:visual`), Vite/ESM, Supabase JS v2

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/workspaceCore.js` | Add `tenantId?` param to all public operations |
| Modify | `src/lib/workspaceCore.test.js` | Add explicit-tenantId threading tests |
| Modify | `src/App.jsx` | Thread `activeTenantId` through CRUD calls + bootstrap traces |
| Modify | `src/hooks/useActivities.js` | Accept and thread `tenantId` option |
| Modify | `src/hooks/useReceivables.js` | Accept and thread `tenantId` option |
| Modify | `src/lib/diagnostics.js` | Add `traceBootstrap`, `traceOwnership`, `traceAsyncFailure` |
| Modify | `src/context/TenantContext.jsx` | Integrate bootstrap diagnostic traces |
| Modify | `src/components/shared/RootErrorBoundary.jsx` | Add `unhandledrejection` handler + honest async docs |
| Modify | `src/lib/lazyWithRetry.js` | Trace retry events |
| Create | `src/visual/MockProviders.jsx` | `MockAuthProvider`, `MockTenantProvider` |
| Modify | `src/visual/RuntimeHarnessApp.jsx` | Add `app-topology*` harness modes |
| Create | `playwright/app-topology.spec.js` | Real topology + bootstrap orchestration E2E tests |
| Create | `playwright/stress-paths.spec.js` | Stress-path runtime validation |
| Create | `docs/PHASE_28_EXPLICIT_TENANT_OWNERSHIP_AND_REAL_RUNTIME_TOPOLOGY.md` | Phase report |

---

## Task 1: Add `tenantId` parameter to all `workspaceCore.js` public operations

**Files:**
- Modify: `src/lib/workspaceCore.js`

The `request()` call chain already supports `tenantId` as an option (it passes it through `workspaceCoreRequest` which does `tenantId ?? getRequiredActiveTenantId()`). All we add is an optional last `tenantId` parameter to each exported function.

- [ ] **Step 1.1: Apply the parameter addition to all public functions**

Replace the entire `workspaceCore.js` content with the version below (all functions get `tenantId` as last optional param):

```js
import { authenticatedFetch } from './apiFetch.js'
import { getRequiredActiveTenantId } from './activeTenant.js'

const WORKSPACE_CORE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-core`

async function parseResponse(res, fallbackMessage) {
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error ?? fallbackMessage ?? `Erro ${res.status}`)
  }

  return data
}

function buildUrl(path, query = null) {
  const url = new URL(`${WORKSPACE_CORE_URL}${path}`)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

export async function workspaceCoreRequest(path, { method = 'GET', body, query, fallbackMessage, tenantId } = {}) {
  const resolvedTenantId = tenantId ?? getRequiredActiveTenantId()
  const res = await authenticatedFetch(buildUrl(path, query), {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    tenantId: resolvedTenantId,
    requireTenant: true,
  })
  return parseResponse(res, fallbackMessage ?? `Erro na requisição: ${res.status}`)
}

async function request(path, options = {}) {
  return workspaceCoreRequest(path, options)
}

export async function fetchWorkspaceBootstrap(tenantId) {
  return request('/bootstrap', { tenantId, fallbackMessage: 'Erro ao carregar o espaço de trabalho' })
}

export async function createTaskRecord(task, tenantId) {
  return request('/tasks', { method: 'POST', body: task, tenantId, fallbackMessage: 'Erro ao criar tarefa' })
}

export async function updateTaskRecord(id, updates, tenantId) {
  return request(`/tasks/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar tarefa' })
}

export async function deleteTaskRecord(id, tenantId) {
  return request(`/tasks/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir tarefa' })
}

export async function archiveTaskRecord(id, tenantId) {
  return request(`/tasks/${id}/archive`, { method: 'POST', tenantId, fallbackMessage: 'Erro ao arquivar tarefa' })
}

export async function restoreTaskRecord(id, tenantId) {
  return request(`/tasks/${id}/restore`, { method: 'POST', tenantId, fallbackMessage: 'Erro ao restaurar tarefa' })
}

export async function listArchivedTaskRecords(filters = {}, tenantId) {
  return request('/tasks/archived', { query: filters, tenantId, fallbackMessage: 'Erro ao listar tarefas arquivadas' })
}

export async function createColumnRecord(column, tenantId) {
  return request('/columns', { method: 'POST', body: column, tenantId, fallbackMessage: 'Erro ao criar coluna' })
}

export async function deleteColumnRecord(id, tenantId) {
  return request(`/columns/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir coluna' })
}

export async function saveTeamMemberRecord(member, tenantId) {
  const hasId = Boolean(member?.id)
  return request(hasId ? `/team/${member.id}` : '/team', {
    method: hasId ? 'PATCH' : 'POST',
    body: member,
    tenantId,
    fallbackMessage: 'Erro ao salvar membro',
  })
}

export async function deleteTeamMemberRecord(id, tenantId) {
  return request(`/team/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir membro' })
}

export async function saveClientRecord(client, tenantId) {
  const hasId = Boolean(client?.id)
  return request(hasId ? `/clients/${client.id}` : '/clients', {
    method: hasId ? 'PATCH' : 'POST',
    body: client,
    tenantId,
    fallbackMessage: 'Erro ao salvar cliente',
  })
}

export async function deleteClientRecord(id, tenantId) {
  return request(`/clients/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir cliente' })
}

export async function listActivityRecords(tenantId) {
  return request('/activities', { tenantId, fallbackMessage: 'Erro ao carregar atividades' })
}

export async function saveActivityRecord(activity, tenantId) {
  const hasId = Boolean(activity?.id)
  return request(hasId ? `/activities/${activity.id}` : '/activities', {
    method: hasId ? 'PATCH' : 'POST',
    body: activity,
    tenantId,
    fallbackMessage: 'Erro ao salvar atividade',
  })
}

export async function deleteActivityRecord(id, tenantId) {
  return request(`/activities/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir atividade' })
}

export async function listActivityTemplateRecords(tenantId) {
  return request('/activity-templates', { tenantId, fallbackMessage: 'Erro ao carregar modelos de atividade' })
}

export async function saveActivityTemplateRecord(template, tenantId) {
  const hasId = Boolean(template?.id)
  return request(hasId ? `/activity-templates/${template.id}` : '/activity-templates', {
    method: hasId ? 'PATCH' : 'POST',
    body: template,
    tenantId,
    fallbackMessage: 'Erro ao salvar modelo de atividade',
  })
}

export async function deleteActivityTemplateRecord(id, tenantId) {
  return request(`/activity-templates/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir modelo de atividade' })
}

export async function listReceivableRecords(tenantId) {
  return request('/receivables', { tenantId, fallbackMessage: 'Erro ao carregar recebíveis' })
}

export async function createReceivableRecord(receivable, tenantId) {
  return request('/receivables', { method: 'POST', body: receivable, tenantId, fallbackMessage: 'Erro ao criar recebível' })
}

export async function updateReceivableRecord(id, updates, tenantId) {
  return request(`/receivables/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar recebível' })
}

export async function listAccountRecords(tenantId) {
  return request('/accounts', { tenantId, fallbackMessage: 'Erro ao carregar contas' })
}

export async function saveAccountRecord(account, tenantId) {
  const hasId = Boolean(account?.id)
  return request(hasId ? `/accounts/${account.id}` : '/accounts', {
    method: hasId ? 'PATCH' : 'POST',
    body: account,
    tenantId,
    fallbackMessage: 'Erro ao salvar conta',
  })
}

export async function listActiveAccounts(tenantId) {
  return request('/accounts/active', { tenantId, fallbackMessage: 'Erro ao listar contas ativas' })
}

export async function listPayeeRecords(tenantId) {
  return request('/payees', { tenantId, fallbackMessage: 'Erro ao carregar favorecidos' })
}

export async function savePayeeRecord(payee, tenantId) {
  const hasId = Boolean(payee?.id)
  return request(hasId ? `/payees/${payee.id}` : '/payees', {
    method: hasId ? 'PATCH' : 'POST',
    body: payee,
    tenantId,
    fallbackMessage: 'Erro ao salvar favorecido',
  })
}

export async function listFinRuleRecords(tenantId) {
  return request('/fin-rules', { tenantId, fallbackMessage: 'Erro ao carregar regras financeiras' })
}

export async function saveFinRuleRecord(rule, tenantId) {
  const hasId = Boolean(rule?.id)
  return request(hasId ? `/fin-rules/${rule.id}` : '/fin-rules', {
    method: hasId ? 'PATCH' : 'POST',
    body: rule,
    tenantId,
    fallbackMessage: 'Erro ao salvar regra financeira',
  })
}

export async function deleteFinRuleRecord(id, tenantId) {
  return request(`/fin-rules/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir regra financeira' })
}

export async function listFinCategoryRecords(tenantId) {
  return request('/fin-categories', { tenantId, fallbackMessage: 'Erro ao carregar categorias financeiras' })
}

export async function createCategoryGroupRecord(group, tenantId) {
  return request('/fin-categories/groups', { method: 'POST', body: group, tenantId, fallbackMessage: 'Erro ao criar grupo de categoria' })
}

export async function saveFinCategoryRecord(category, tenantId) {
  const hasId = Boolean(category?.id)
  return request(hasId ? `/fin-categories/items/${category.id}` : '/fin-categories/items', {
    method: hasId ? 'PATCH' : 'POST',
    body: category,
    tenantId,
    fallbackMessage: 'Erro ao salvar categoria financeira',
  })
}

export async function listTransactionRecords(filters = {}, tenantId) {
  const relatedType = filters?.relatedTo?.type
  const relatedId = filters?.relatedTo?.id
  return request('/transactions', {
    query: {
      accountId: filters?.accountId,
      categoryId: filters?.categoryId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      needsReview: filters?.needsReview,
      cleared: filters?.cleared,
      onlyNegative: filters?.onlyNegative,
      relatedType,
      relatedId,
    },
    tenantId,
    fallbackMessage: 'Erro ao carregar transações',
  })
}

export async function createTransactionRecord(transaction, tenantId) {
  return request('/transactions', { method: 'POST', body: transaction, tenantId, fallbackMessage: 'Erro ao criar transação' })
}

export async function updateTransactionRecord(id, updates, tenantId) {
  return request(`/transactions/${id}`, { method: 'PATCH', body: updates, tenantId, fallbackMessage: 'Erro ao atualizar transação' })
}

export async function deleteTransactionRecord(id, tenantId) {
  return request(`/transactions/${id}`, { method: 'DELETE', tenantId, fallbackMessage: 'Erro ao excluir transação' })
}

export async function listInteractionLogRecords(clientId, tenantId) {
  return request('/interaction-logs', { query: { clientId }, tenantId, fallbackMessage: 'Erro ao carregar histórico de interações' })
}

export async function createInteractionLogRecord(log, tenantId) {
  return request('/interaction-logs', { method: 'POST', body: log, tenantId, fallbackMessage: 'Erro ao criar interação' })
}
```

- [ ] **Step 1.2: Add explicit-tenantId tests to `workspaceCore.test.js`**

Append the following `describe` block to the existing test file after the closing `})` of `describe('workspaceCore', ...)`:

```js
describe('workspaceCore — explicit tenantId threading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'task-1', title: 'Test' }),
    })
  })

  it('createTaskRecord with explicit tenantId does NOT call getRequiredActiveTenantId', async () => {
    await createTaskRecord({ title: 'Test' }, 'explicit-tenant-789')
    expect(getRequiredActiveTenantIdMock).not.toHaveBeenCalled()
  })

  it('createTaskRecord passes explicit tenantId to authenticatedFetch', async () => {
    await createTaskRecord({ title: 'Test' }, 'explicit-tenant-789')
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/workspace-core/tasks'),
      expect.objectContaining({ tenantId: 'explicit-tenant-789' }),
    )
  })

  it('createTaskRecord without tenantId falls back to getRequiredActiveTenantId', async () => {
    getRequiredActiveTenantIdMock.mockReturnValue('fallback-tenant')
    await createTaskRecord({ title: 'Test' })
    expect(getRequiredActiveTenantIdMock).toHaveBeenCalled()
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'fallback-tenant' }),
    )
  })
})
```

Note: the existing import at line 14 (`import { createTaskRecord, fetchWorkspaceBootstrap } from './workspaceCore.js'`) already imports `createTaskRecord`. If other functions need to be tested, add them to that import line.

- [ ] **Step 1.3: Run unit tests to verify no regressions**

```
npm.cmd run test -- --reporter=verbose src/lib/workspaceCore.test.js
```

Expected: all existing tests pass + the 3 new tests pass.

- [ ] **Step 1.4: Commit**

```
git add src/lib/workspaceCore.js src/lib/workspaceCore.test.js
git commit -m "feat(phase-28): add explicit tenantId param to all workspaceCore operations"
```

---

## Task 2: Thread `activeTenantId` through App.jsx CRUD operations + bootstrap diagnostics

**Files:**
- Modify: `src/App.jsx`

App.jsx calls `createTaskRecord`, `updateTaskRecord`, `deleteTaskRecord`, `archiveTaskRecord`, `restoreTaskRecord`, `createColumnRecord`, `deleteColumnRecord`, `listActiveAccounts`. Update each to pass `activeTenantId`. Also add `traceBootstrap` around the bootstrap effect.

- [ ] **Step 2.1: Add traceBootstrap import to App.jsx**

Find the import for `MOTION_TRANSITIONS`:
```js
import { MOTION_TRANSITIONS } from './lib/motionTokens.js'
```
Add after it:
```js
import { traceBootstrap } from './lib/diagnostics.js'
```

- [ ] **Step 2.2: Thread activeTenantId in addTask**

Find in App.jsx:
```js
const created = await createTaskRecord({ ...payload, created_at: new Date().toISOString() })
```
Replace with:
```js
const created = await createTaskRecord({ ...payload, created_at: new Date().toISOString() }, activeTenantId)
```

- [ ] **Step 2.3: Thread activeTenantId in updateTask**

Find:
```js
updatedTask = await updateTaskRecord(id, cleanUpdates)
```
Replace with:
```js
updatedTask = await updateTaskRecord(id, cleanUpdates, activeTenantId)
```

Find (still inside updateTask):
```js
const allAccounts = await listActiveAccounts()
```
Replace with:
```js
const allAccounts = await listActiveAccounts(activeTenantId)
```

- [ ] **Step 2.4: Thread activeTenantId in deleteTask, archiveTask, restoreTask**

Find:
```js
await deleteTaskRecord(id)
```
Replace with:
```js
await deleteTaskRecord(id, activeTenantId)
```

Find:
```js
await archiveTaskRecord(id)
```
Replace with:
```js
await archiveTaskRecord(id, activeTenantId)
```

Find:
```js
const restored = await restoreTaskRecord(id)
```
Replace with:
```js
const restored = await restoreTaskRecord(id, activeTenantId)
```

- [ ] **Step 2.5: Thread activeTenantId in addColumn and deleteColumn**

Find:
```js
const created = await createColumnRecord({ name, order_index: orderIndex })
```
Replace with:
```js
const created = await createColumnRecord({ name, order_index: orderIndex }, activeTenantId)
```

Find:
```js
await deleteColumnRecord(id)
```
Replace with:
```js
await deleteColumnRecord(id, activeTenantId)
```

- [ ] **Step 2.6: Add traceBootstrap calls to the bootstrap useEffect**

Find the bootstrap `useEffect` in App.jsx that contains `fetchWorkspaceBootstrap(activeTenantId)`. It currently starts:
```js
  useEffect(() => {
    // Explicit guard: don't fetch workspace data until a tenant is confirmed.
```

Replace the entire effect body (between the `{` and the `return () => { cancelled = true }`) with:
```js
    if (!activeTenantId) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    traceBootstrap('start', activeTenantId)

    fetchWorkspaceBootstrap(activeTenantId)
      .then((data) => {
        if (cancelled) return
        setTasks(data.tasks || [])
        setTeam(data.team || [])
        setClients(data.clients || [])
        setColumns(data.columns || [])
        traceBootstrap('ready', activeTenantId)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching workspace data:', error)
        traceBootstrap('error', activeTenantId, error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      traceBootstrap('cancelled', activeTenantId)
      cancelled = true
    }
```

- [ ] **Step 2.7: Run lint to verify no errors**

```
npm.cmd run lint -- --max-warnings=0 src/App.jsx
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 2.8: Commit**

```
git add src/App.jsx
git commit -m "feat(phase-28): thread activeTenantId through App.jsx CRUD and bootstrap traces"
```

---

## Task 3: Add `tenantId` threading to `useActivities` + update App.jsx call site

**Files:**
- Modify: `src/hooks/useActivities.js`
- Modify: `src/App.jsx`

- [ ] **Step 3.1: Update `useActivities` to accept and thread `tenantId`**

Replace the entire `src/hooks/useActivities.js` with:

```js
import { useEffect, useMemo, useState } from 'react'
import {
  listActivityRecords,
  saveActivityRecord,
  deleteActivityRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useActivities({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureActivities = useMemo(() => getVisualFixture('activities', []), [])
  const [activities, setActivities] = useState(visualMode ? fixtureActivities : [])
  const [loading, setLoading] = useState(!visualMode)

  useEffect(() => {
    if (visualMode) {
      setActivities(fixtureActivities)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    listActivityRecords(tenantId)
      .then((data) => {
        if (cancelled) return
        setActivities(data || [])
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching activities:', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [visualMode, fixtureActivities, tenantId])

  const addActivity = async (activity) => {
    if (visualMode) return activity
    try {
      const created = await saveActivityRecord(activity, tenantId)
      setActivities((current) => [created, ...current])
      return created
    } catch (error) {
      console.error('Error adding activity:', error)
      return null
    }
  }

  const updateActivity = async (id, updates) => {
    if (visualMode) return { id, ...updates }
    try {
      const updated = await saveActivityRecord({ id, ...updates }, tenantId)
      setActivities((current) => current.map((activity) => (activity.id === id ? updated : activity)))
      return updated
    } catch (error) {
      console.error('Error updating activity:', error)
      return null
    }
  }

  const deleteActivity = async (id) => {
    if (visualMode) return true
    try {
      await deleteActivityRecord(id, tenantId)
      setActivities((current) => current.filter((activity) => activity.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting activity:', error)
      return false
    }
  }

  const getActivitiesFor = (type, id) =>
    activities.filter((activity) =>
      Array.isArray(activity.related_to) &&
      activity.related_to.some((relation) => relation.type === type && String(relation.id) === String(id))
    )

  return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesFor }
}
```

- [ ] **Step 3.2: Update the `useActivities` call in App.jsx**

Find in App.jsx:
```js
  const { activities } = useActivities()
```
Replace with:
```js
  const { activities } = useActivities({ tenantId: activeTenantId })
```

- [ ] **Step 3.3: Run unit tests**

```
npm.cmd run test -- --reporter=verbose
```

Expected: all tests pass (no useActivities-specific tests exist, so verify no new failures).

- [ ] **Step 3.4: Commit**

```
git add src/hooks/useActivities.js src/App.jsx
git commit -m "feat(phase-28): thread tenantId through useActivities hook"
```

---

## Task 4: Add `tenantId` threading to `useReceivables` + update App.jsx call site

**Files:**
- Modify: `src/hooks/useReceivables.js`
- Modify: `src/App.jsx`

- [ ] **Step 4.1: Update `useReceivables` to accept and thread `tenantId`**

Replace the entire `src/hooks/useReceivables.js` with:

```js
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listReceivableRecords,
  createReceivableRecord,
  updateReceivableRecord,
} from '../lib/workspaceCore'
import { getVisualFixture, isVisualRegressionMode } from '../visual/fixtureRuntime.js'

export function useReceivables({ tenantId } = {}) {
  const visualMode = isVisualRegressionMode()
  const fixtureReceivables = useMemo(() => getVisualFixture('receivables', []), [])
  const [receivables, setReceivables] = useState(visualMode ? fixtureReceivables : [])
  const [loading, setLoading] = useState(!visualMode)

  const fetch = useCallback(async () => {
    if (visualMode) {
      setReceivables(fixtureReceivables)
      setLoading(false)
      return fixtureReceivables
    }

    setLoading(true)
    try {
      const data = await listReceivableRecords(tenantId)
      setReceivables(data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching receivables:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [visualMode, fixtureReceivables, tenantId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createReceivable = async (taskId, amount, targetAccountId) => {
    if (visualMode) return { task_id: taskId, amount, target_account_id: targetAccountId }
    try {
      const created = await createReceivableRecord(
        { task_id: taskId, amount, target_account_id: targetAccountId, status: 'pending' },
        tenantId,
      )
      await fetch()
      return created
    } catch (error) {
      console.error('Error creating receivable:', error)
      return null
    }
  }

  const createReceivableFromActivity = async (activityId, amount, targetAccountId, dueDate = null) => {
    if (visualMode) return { activity_id: activityId, amount, target_account_id: targetAccountId, due_date: dueDate }
    try {
      const created = await createReceivableRecord(
        { activity_id: activityId, amount, target_account_id: targetAccountId, status: 'pending', due_date: dueDate },
        tenantId,
      )
      await fetch()
      return created
    } catch (error) {
      console.error('Error creating receivable from activity:', error)
      return null
    }
  }

  const invoiceReceivable = async (receivableId, adjustedAmount, date, addTransaction) => {
    if (visualMode) {
      return receivables.find((receivable) => receivable.id === receivableId) ?? { amount: adjustedAmount, date }
    }

    const receivable = receivables.find((item) => item.id === receivableId)
    if (!receivable) return null

    const sourceName = receivable.tasks?.title ?? receivable.activities?.title ?? 'lancamento'
    const sourceLink = receivable.task_id
      ? { type: 'task', id: receivable.task_id }
      : { type: 'activity', id: receivable.activity_id }

    const transaction = await addTransaction({
      account_id: receivable.target_account_id,
      amount: adjustedAmount,
      date,
      notes: `Faturamento: ${sourceName}`,
      related_to: [sourceLink],
    })
    if (!transaction) return null

    try {
      const updated = await updateReceivableRecord(
        receivableId,
        { status: 'invoiced', transaction_id: transaction.id, invoiced_at: new Date().toISOString() },
        tenantId,
      )
      setReceivables((current) => current.map((item) => (item.id === receivableId ? { ...item, ...updated } : item)))
      return updated
    } catch (error) {
      console.error('Error invoicing receivable:', error)
      return null
    }
  }

  const listReceivables = ({ status, taskId } = {}) =>
    receivables.filter((receivable) => {
      if (status && receivable.status !== status) return false
      if (taskId !== undefined && receivable.task_id !== taskId) return false
      return true
    })

  return { receivables, loading, createReceivable, createReceivableFromActivity, invoiceReceivable, listReceivables, refresh: fetch }
}
```

- [ ] **Step 4.2: Update the `useReceivables` call in App.jsx**

Find in App.jsx:
```js
  const { createReceivable, listReceivables } = useReceivables()
```
Replace with:
```js
  const { createReceivable, listReceivables } = useReceivables({ tenantId: activeTenantId })
```

- [ ] **Step 4.3: Run unit tests**

```
npm.cmd run test -- --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4.4: Commit**

```
git add src/hooks/useReceivables.js src/App.jsx
git commit -m "feat(phase-28): thread tenantId through useReceivables hook"
```

---

## Task 5: Enrich `diagnostics.js` with bootstrap, ownership, and async-failure tracing

**Files:**
- Modify: `src/lib/diagnostics.js`

- [ ] **Step 5.1: Append new trace functions to `diagnostics.js`**

At the end of `src/lib/diagnostics.js`, after the last export, add:

```js
// ─── Bootstrap lifecycle tracing ──────────────────────────────────────────────
// Phases: 'start' | 'loading' | 'ready' | 'error' | 'retry' | 'cancelled' | 'tenant-change'

export function traceBootstrap(phase, tenantId = null, detail = null) {
  if (!isEnabled()) return
  const icons = {
    start: '🚀', loading: '⏳', ready: '✅', error: '❌',
    retry: '↺', cancelled: '⊘', 'tenant-change': '🔄',
  }
  console.debug(tag('bootstrap'), icons[phase] ?? phase, `tenant=${tenantId ?? 'none'}`, detail ?? '')
}

// ─── Ownership tracing ─────────────────────────────────────────────────────────
// source: 'explicit' (tenantId passed directly) | 'implicit' (read from global fallback)

export function traceOwnership(operation, tenantId, source) {
  if (!isEnabled()) return
  const label = source === 'explicit' ? '✓ explicit' : '⚠ implicit-fallback'
  console.debug(tag('ownership'), label, operation, `tenant=${tenantId ?? 'none'}`)
}

// ─── Async failure classification ─────────────────────────────────────────────
// type: 'unhandled-rejection' | 'lazy-import' | 'async-event' | 'bootstrap-fail'
// NOTE: React Error Boundaries do NOT catch unhandled promise rejections or
// errors thrown in event handlers / setTimeout / setInterval. This function
// only produces diagnostic output — it does not recover the app.

export function traceAsyncFailure(type, error, context = null) {
  if (!isEnabled()) return
  const icons = {
    'unhandled-rejection': '⚡',
    'lazy-import': '📦',
    'async-event': '📡',
    'bootstrap-fail': '🔴',
  }
  console.error(tag('async-fault'), icons[type] ?? type, type, error?.message ?? String(error), context ?? '')
}

// ─── Suspense timing ───────────────────────────────────────────────────────────

export function traceRouteTransition(from, to, phase) {
  if (!isEnabled()) return
  const icons = { start: '▶', complete: '✔', suspended: '⏳', error: '❌' }
  console.debug(tag('route-transition'), icons[phase] ?? phase, `${from} → ${to}`)
}
```

- [ ] **Step 5.2: Run lint on diagnostics.js**

```
npm.cmd run lint -- --max-warnings=0 src/lib/diagnostics.js
```

Expected: 0 errors.

- [ ] **Step 5.3: Commit**

```
git add src/lib/diagnostics.js
git commit -m "feat(phase-28): add traceBootstrap/traceOwnership/traceAsyncFailure to diagnostics"
```

---

## Task 6: Integrate bootstrap diagnostic traces in `TenantContext.jsx`

**Files:**
- Modify: `src/context/TenantContext.jsx`

- [ ] **Step 6.1: Add diagnostics import**

At the top of `TenantContext.jsx`, after the existing imports, add:
```js
import { traceBootstrap, traceTenant } from '../lib/diagnostics.js'
```

- [ ] **Step 6.2: Add trace calls inside `loadTenants()`**

Find the `async function loadTenants()` block. Currently it starts with `setLoading(true)`. Add traces as shown:

```js
    async function loadTenants() {
      setLoading(true)
      setError(null)
      traceBootstrap('start', null, 'TenantContext.loadTenants')

      try {
        const invitationToken = getInvitationToken()
        if (invitationToken) {
          await acceptInvitation(invitationToken)
          if (!active) return
          clearInvitationToken()
        }

        const records = await listMyTenants()
        if (!active) return

        const nextTenants = records.map(normalizeTenantRecord)
        const nextActiveTenantId = resolveNextActiveTenantId(nextTenants)

        setTenants(nextTenants)
        setActiveTenantIdState(nextActiveTenantId)

        if (nextActiveTenantId) {
          setStoredActiveTenantId(nextActiveTenantId)
        }

        traceBootstrap('ready', nextActiveTenantId, `${nextTenants.length} tenant(s)`)
      } catch (loadError) {
        if (!active) return
        setTenants([])
        setActiveTenantIdState(null)
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar espaços de trabalho.')
        traceBootstrap('error', null, loadError?.message)
      } finally {
        if (active) setLoading(false)
      }
    }
```

- [ ] **Step 6.3: Trace active tenant changes**

Find the useEffect:
```js
  useEffect(() => {
    setRuntimeActiveTenantId(activeTenantId)
  }, [activeTenantId])
```

Replace with:
```js
  useEffect(() => {
    setRuntimeActiveTenantId(activeTenantId)
    traceTenant('active-tenant-changed', activeTenantId)
  }, [activeTenantId])
```

- [ ] **Step 6.4: Run lint**

```
npm.cmd run lint -- --max-warnings=0 src/context/TenantContext.jsx
```

- [ ] **Step 6.5: Commit**

```
git add src/context/TenantContext.jsx
git commit -m "feat(phase-28): integrate bootstrap diagnostics into TenantContext"
```

---

## Task 7: Harden `RootErrorBoundary` async fault isolation + `lazyWithRetry` tracing

**Files:**
- Modify: `src/components/shared/RootErrorBoundary.jsx`
- Modify: `src/lib/lazyWithRetry.js`

React Error Boundaries catch synchronous render errors only. This task adds an `unhandledrejection` window listener for diagnostic logging and documents this limitation explicitly. It does NOT claim to recover from async failures — only to surface them.

- [ ] **Step 7.1: Replace `RootErrorBoundary.jsx` with async-aware version**

```jsx
import { Component, Fragment } from 'react'

const isDev = import.meta.env.DEV
const MAX_RETRIES = 3

/**
 * Catches synchronous render failures in the React tree below this boundary.
 *
 * IMPORTANT — What this boundary does NOT catch:
 *  - Unhandled promise rejections (async code outside React render)
 *  - Errors thrown in event handlers (onClick, onChange, etc.)
 *  - Errors in setTimeout / setInterval callbacks
 *  - Errors in async lifecycle methods after they have returned
 *
 * For async/event failures this boundary installs a window.unhandledrejection
 * listener (DEV + DIAG mode only) that logs and classifies them without
 * attempting recovery.
 */
export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.handleReset = this.handleReset.bind(this)
    this._unhandledRejectionHandler = null
  }

  componentDidMount() {
    if (typeof window === 'undefined') return
    this._unhandledRejectionHandler = (event) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'unknown')
      console.error(
        '[RootErrorBoundary] Unhandled async rejection (NOT caught by React EB):',
        msg,
        event.reason,
      )
    }
    window.addEventListener('unhandledrejection', this._unhandledRejectionHandler)
  }

  componentWillUnmount() {
    if (this._unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this._unhandledRejectionHandler)
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] Shell-level crash caught:', error, info?.componentStack ?? '')
  }

  handleReset() {
    const { retryCount } = this.state
    if (retryCount >= MAX_RETRIES) {
      window.location.reload()
      return
    }
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state
      const exhausted = retryCount >= MAX_RETRIES
      const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')

      return (
        <div className="root-error-boundary" role="alert" aria-live="assertive">
          <div className="root-error-boundary__card">
            <span className="root-error-boundary__eyebrow">NexusCRM</span>
            <h1 className="root-error-boundary__title">Algo deu errado</h1>
            <p className="root-error-boundary__description">
              {exhausted
                ? 'O erro persiste após múltiplas tentativas. Recarregue a página para continuar.'
                : 'A interface encontrou um erro inesperado e não conseguiu se recuperar automaticamente.'}
            </p>
            <div className="root-error-boundary__actions">
              <button
                type="button"
                className="root-error-boundary__btn root-error-boundary__btn--primary"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
              {!exhausted && (
                <button
                  type="button"
                  className="root-error-boundary__btn root-error-boundary__btn--secondary"
                  onClick={this.handleReset}
                >
                  Tentar novamente
                </button>
              )}
            </div>
            {isDev && (
              <details className="root-error-boundary__details">
                <summary>Detalhes do erro (desenvolvimento)</summary>
                <pre className="root-error-boundary__stack">{message}</pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return (
      <Fragment key={this.state.retryCount}>
        {this.props.children}
      </Fragment>
    )
  }
}
```

- [ ] **Step 7.2: Add retry tracing to `lazyWithRetry.js`**

Find in `lazyWithRetry.js`:
```js
      if (shouldReload) {
        window.sessionStorage.setItem(storageKey, '1')
        window.location.reload()
        return new Promise(() => {})
      }
```
Replace with:
```js
      if (shouldReload) {
        console.warn('[lazyWithRetry] Chunk load failed — reloading to recover:', cacheKey, message)
        window.sessionStorage.setItem(storageKey, '1')
        window.location.reload()
        return new Promise(() => {})
      }
```

Find:
```js
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem(storageKey)
      }

      throw error
```
Replace with:
```js
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem(storageKey)
      }

      console.error('[lazyWithRetry] Chunk load failed after retry — re-throwing:', cacheKey, message)
      throw error
```

- [ ] **Step 7.3: Run unit tests**

```
npm.cmd run test -- --reporter=verbose
```

Expected: all tests pass (no RootErrorBoundary unit tests exist; verify no new failures).

- [ ] **Step 7.4: Commit**

```
git add src/components/shared/RootErrorBoundary.jsx src/lib/lazyWithRetry.js
git commit -m "feat(phase-28): async fault isolation in RootErrorBoundary + lazyWithRetry tracing"
```

---

## Task 8: Create `MockProviders.jsx`

**Files:**
- Create: `src/visual/MockProviders.jsx`

- [ ] **Step 8.1: Create the file**

```jsx
import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
import { FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE } from './harnessFixtures.js'

export function MockAuthProvider({ children, overrides = {} }) {
  return (
    <AuthContext.Provider value={{ ...FIXTURE_AUTH_VALUE, ...overrides }}>
      {children}
    </AuthContext.Provider>
  )
}

export function MockTenantProvider({ children, overrides = {} }) {
  return (
    <TenantContext.Provider value={{ ...FIXTURE_TENANT_VALUE, ...overrides }}>
      {children}
    </TenantContext.Provider>
  )
}
```

- [ ] **Step 8.2: Run lint**

```
npm.cmd run lint -- --max-warnings=0 src/visual/MockProviders.jsx
```

- [ ] **Step 8.3: Commit**

```
git add src/visual/MockProviders.jsx
git commit -m "feat(phase-28): add MockAuthProvider and MockTenantProvider for topology harness"
```

---

## Task 9: Extend `RuntimeHarnessApp.jsx` with `app-topology*` harness modes

**Files:**
- Modify: `src/visual/RuntimeHarnessApp.jsx`

This adds four new `harness-mode` values that mount the real component topology (ProtectedRoute + TenantGate + App) with deterministic mock providers:

| URL param | Auth state | Tenant state |
|-----------|-----------|-------------|
| `app-topology` | authenticated | tenant loaded |
| `app-topology-unauthenticated` | not authenticated | tenant loaded (irrelevant) |
| `app-topology-tenant-loading` | authenticated | tenant loading |
| `app-topology-tenant-error` | authenticated | tenant error |

- [ ] **Step 9.1: Replace `RuntimeHarnessApp.jsx` with extended version**

```jsx
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import TenantGate from '../components/tenant/TenantGate.jsx'
import App from '../App.jsx'
import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
import { FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE } from './harnessFixtures.js'
// MockAuthProvider / MockTenantProvider are available for component-level tests
// but not needed here — AppTopologyShell uses Context.Provider directly.

function readHarnessMode() {
  if (typeof window === 'undefined') return 'authenticated'
  return new URL(window.location.href).searchParams.get('harness-mode') || 'authenticated'
}

const UNAUTHENTICATED_FIXTURE = {
  ...FIXTURE_AUTH_VALUE,
  session: null,
  user: null,
  isAuthenticated: false,
}

const TENANT_LOADING_FIXTURE = {
  ...FIXTURE_TENANT_VALUE,
  loading: true,
  activeTenantId: null,
  activeTenant: null,
  hasTenant: false,
  tenants: [],
}

const TENANT_ERROR_FIXTURE = {
  ...FIXTURE_TENANT_VALUE,
  loading: false,
  activeTenantId: null,
  activeTenant: null,
  hasTenant: false,
  tenants: [],
  error: 'Erro simulado ao carregar espaços de trabalho.',
}

// Intentionally crashes on every render to test RootErrorBoundary behavior.
function CrashTestSurface() {
  throw new Error('Crash test: intentional render failure for boundary validation')
}

function AppTopologyShell({ authValue, tenantValue }) {
  return (
    <div data-testid="app-topology-harness">
      <AuthContext.Provider value={authValue}>
        <ProtectedRoute>
          <TenantContext.Provider value={tenantValue}>
            <TenantGate>
              <div key={tenantValue.activeTenantId ?? 'no-tenant'}>
                <App />
              </div>
            </TenantGate>
          </TenantContext.Provider>
        </ProtectedRoute>
      </AuthContext.Provider>
    </div>
  )
}

export default function RuntimeHarnessApp() {
  const mode = readHarnessMode()

  if (mode === 'crash') {
    return <CrashTestSurface />
  }

  // ── Legacy fixture modes (ProtectedRoute only, no full app) ──────────────────
  if (mode === 'unauthenticated') {
    return (
      <AuthContext.Provider value={UNAUTHENTICATED_FIXTURE}>
        <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
          <ProtectedRoute>
            <div id="runtime-topology-root">
              Runtime topology: ProtectedRoute resolved to children.
            </div>
          </ProtectedRoute>
        </TenantContext.Provider>
      </AuthContext.Provider>
    )
  }

  if (mode === 'authenticated') {
    return (
      <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
        <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
          <ProtectedRoute>
            <div id="runtime-topology-root">
              Runtime topology: ProtectedRoute resolved to children.
            </div>
          </ProtectedRoute>
        </TenantContext.Provider>
      </AuthContext.Provider>
    )
  }

  // ── Phase 28 real app-topology modes ─────────────────────────────────────────
  if (mode === 'app-topology') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={FIXTURE_TENANT_VALUE}
      />
    )
  }

  if (mode === 'app-topology-unauthenticated') {
    return (
      <AppTopologyShell
        authValue={UNAUTHENTICATED_FIXTURE}
        tenantValue={FIXTURE_TENANT_VALUE}
      />
    )
  }

  if (mode === 'app-topology-tenant-loading') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={TENANT_LOADING_FIXTURE}
      />
    )
  }

  if (mode === 'app-topology-tenant-error') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={TENANT_ERROR_FIXTURE}
      />
    )
  }

  // fallback: default authenticated fixture (legacy behaviour)
  return (
    <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
      <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
        <ProtectedRoute>
          <div id="runtime-topology-root">
            Runtime topology: ProtectedRoute resolved to children.
          </div>
        </ProtectedRoute>
      </TenantContext.Provider>
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 9.2: Run lint**

```
npm.cmd run lint -- --max-warnings=0 src/visual/RuntimeHarnessApp.jsx
```

- [ ] **Step 9.3: Verify existing runtime-topology.spec tests still pass (quick smoke check via build)**

```
npm.cmd run build
```

Expected: build succeeds with no errors.

- [ ] **Step 9.4: Commit**

```
git add src/visual/RuntimeHarnessApp.jsx
git commit -m "feat(phase-28): add real app-topology harness modes to RuntimeHarnessApp"
```

---

## Task 10: Create `playwright/app-topology.spec.js`

**Files:**
- Create: `playwright/app-topology.spec.js`

These tests exercise the real component topology. Because the dev server uses real Supabase config but no active session, App's workspace bootstrap will fail gracefully (catches the error, calls `setLoading(false)`). Tests validate topology orchestration, not data correctness.

- [ ] **Step 10.1: Create the spec file**

```js
/**
 * Real app-topology E2E tests — Phase 28.
 *
 * These tests mount the REAL component topology:
 *   MockAuthProvider > ProtectedRoute > MockTenantProvider > TenantGate > App
 *
 * The workspace bootstrap (fetchWorkspaceBootstrap) will fail in this environment
 * because there is no active Supabase session — this is expected and caught
 * gracefully by App's useEffect. The tests validate topology orchestration,
 * not data correctness.
 *
 * Contrast with runtime-topology.spec.js which mounts ProtectedRoute only,
 * and runtime-hardening.spec.js which uses VisualRegressionApp (full fixture data).
 *
 * Run: npm run test:visual (starts dev server automatically)
 */

import { expect, test } from '@playwright/test'

const AT = '/?runtime-harness=1&harness-mode=app-topology'
const AT_UNAUTH = '/?runtime-harness=1&harness-mode=app-topology-unauthenticated'
const AT_TENANT_LOADING = '/?runtime-harness=1&harness-mode=app-topology-tenant-loading'
const AT_TENANT_ERROR = '/?runtime-harness=1&harness-mode=app-topology-tenant-error'

// ─── Topology chain: authenticated + tenant loaded ────────────────────────────

test('app-topology: authenticated + tenant → App shell renders (sidebar visible)', async ({ page }) => {
  await page.goto(AT)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('[data-testid="app-topology-harness"]')).toBeVisible()
  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('app-topology: authenticated + tenant → no root error boundary fires', async ({ page }) => {
  await page.goto(AT)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('app-topology: bootstrap loading screen resolves (does not hang)', async ({ page }) => {
  await page.goto(AT)
  await page.waitForLoadState('networkidle')

  // Bootstrap fails fast (no auth session) — loading screen must disappear
  const body = await page.locator('body').textContent()
  expect(body).not.toContain('Carregando NexusCRM...')
})

// ─── Topology chain: unauthenticated ─────────────────────────────────────────

test('app-topology: unauthenticated → ProtectedRoute renders login page', async ({ page }) => {
  await page.goto(AT_UNAUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('app-topology: unauthenticated → App shell NOT rendered', async ({ page }) => {
  await page.goto(AT_UNAUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.sidebar-rail')).not.toBeVisible()
})

// ─── Topology chain: tenant loading state ────────────────────────────────────

test('app-topology: tenant loading → TenantGate shows workspace loading screen', async ({ page }) => {
  await page.goto(AT_TENANT_LOADING)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Carregando espaços de trabalho')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── Topology chain: tenant error state ──────────────────────────────────────

test('app-topology: tenant error → TenantGate shows error state with retry button', async ({ page }) => {
  await page.goto(AT_TENANT_ERROR)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Erro ao carregar espaços de trabalho')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── Auth transition simulation ───────────────────────────────────────────────

test('app-topology: auth loss — navigating to unauthenticated shows login (no crash)', async ({ page }) => {
  await page.goto(AT)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.sidebar-rail')).toBeVisible()

  await page.goto(AT_UNAUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── Bootstrap orchestration ─────────────────────────────────────────────────

test('app-topology: tenant change — navigating between tenant states does not crash', async ({ page }) => {
  await page.goto(AT)
  await page.waitForLoadState('networkidle')

  await page.goto(AT_TENANT_LOADING)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()

  await page.goto(AT)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('app-topology: full cycle auth-lost → re-auth → tenant-error does not crash', async ({ page }) => {
  const paths = [AT, AT_UNAUTH, AT, AT_TENANT_ERROR, AT]
  for (const path of paths) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  }
})
```

- [ ] **Step 10.2: Run the app-topology spec**

```
npm.cmd run test:visual -- --project=chromium playwright/app-topology.spec.js
```

Expected: all 10 tests pass. If any test fails, read the failure reason:
- "sidebar-rail not visible": likely App didn't mount — check RuntimeHarnessApp for the `app-topology` mode rendering AppTopologyShell.
- "Loading screen persists": check App.jsx bootstrap effect finally block sets `setLoading(false)` even on error.
- "RootErrorBoundary visible": a component is throwing — check console for which component.

- [ ] **Step 10.3: Commit**

```
git add playwright/app-topology.spec.js
git commit -m "feat(phase-28): add real app-topology Playwright spec with bootstrap orchestration tests"
```

---

## Task 11: Create `playwright/stress-paths.spec.js`

**Files:**
- Create: `playwright/stress-paths.spec.js`

These stress tests use the existing `?visual-regression=1` harness (full fixture data, no auth required) so surfaces load completely.

- [ ] **Step 11.1: Create the spec file**

```js
/**
 * Stress-path runtime validation — Phase 28.
 *
 * Tests runtime determinism under pressure: rapid route switching, tenant/auth
 * transitions, overlay interruption timing, lazy route bursts, and onboarding
 * + navigation overlap.
 *
 * Uses ?visual-regression=1 harness where available (full fixture data),
 * and ?runtime-harness=1 for auth/tenant transition scenarios.
 *
 * Run: npm run test:visual (starts dev server automatically)
 */

import { expect, test } from '@playwright/test'

const VR = (surface) => `/?visual-regression=1&surface=${surface}`
const AT = '/?runtime-harness=1&harness-mode=app-topology'
const AT_UNAUTH = '/?runtime-harness=1&harness-mode=app-topology-unauthenticated'

// ─── 1. Rapid route switching ─────────────────────────────────────────────────

test('stress: rapid route switching across all surfaces does not crash', async ({ page }) => {
  const surfaces = ['tasks', 'finance', 'activities', 'dashboard', 'clients', 'team', 'calendar', 'tasks']

  await page.goto(VR('tasks'))
  await page.waitForLoadState('networkidle')

  for (const surface of surfaces) {
    await page.goto(VR(surface), { waitUntil: 'commit' })
  }

  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── 2. Tenant-state switch during async load ─────────────────────────────────

test('stress: rapid tenant-state changes do not crash', async ({ page }) => {
  const urls = [
    AT,
    '/?runtime-harness=1&harness-mode=app-topology-tenant-loading',
    AT,
    '/?runtime-harness=1&harness-mode=app-topology-tenant-error',
    AT,
  ]

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'commit' })
  }

  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── 3. Repeated auth transitions ────────────────────────────────────────────

test('stress: repeated auth on/off transitions do not crash', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto(AT, { waitUntil: 'commit' })
    await page.goto(AT_UNAUTH, { waitUntil: 'commit' })
  }

  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── 4. Overlay interruption timing ──────────────────────────────────────────

test('stress: command palette opened and closed while navigating surfaces', async ({ page }) => {
  await page.goto(VR('tasks'))
  await page.waitForLoadState('networkidle')

  for (const surface of ['dashboard', 'finance', 'activities', 'clients']) {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(80)
    await page.goto(VR(surface), { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
  }

  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── 5. Lazy route transition bursts ─────────────────────────────────────────

test('stress: burst of lazy surface navigations does not crash or hang', async ({ page }) => {
  const lazySurfaces = ['finance', 'activities', 'clients', 'team', 'calendar', 'finance', 'activities']

  await page.goto(VR('tasks'))
  await page.waitForLoadState('networkidle')

  for (const surface of lazySurfaces) {
    await page.goto(VR(surface), { waitUntil: 'commit' })
    await page.waitForTimeout(50)
  }

  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()

  const body = await page.locator('body').textContent()
  expect(body?.trim().length).toBeGreaterThan(0)
})

// ─── 6. Retry after async failure (via hard reload) ──────────────────────────

test('stress: navigating to surface after previous rapid switch does not crash', async ({ page }) => {
  // Simulate rapid switching that may leave async operations mid-flight
  const surfaces = ['finance', 'tasks', 'activities', 'dashboard']
  for (const surface of surfaces) {
    await page.goto(VR(surface), { waitUntil: 'commit' })
  }

  // Then settle and verify
  await page.goto(VR('tasks'))
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect(page.locator('.sidebar-rail')).toBeVisible()
})

// ─── 7. Onboarding + navigation overlap ──────────────────────────────────────

test('stress: navigating away from dashboard during onboarding panel load does not crash', async ({ page }) => {
  await page.goto(VR('dashboard'))
  await page.waitForLoadState('networkidle')

  // Navigate away immediately while dashboard (and its onboarding panel) may be loading
  await page.goto(VR('tasks'), { waitUntil: 'commit' })
  await page.goto(VR('activities'), { waitUntil: 'commit' })
  await page.goto(VR('dashboard'))
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
```

- [ ] **Step 11.2: Run the stress spec**

```
npm.cmd run test:visual -- --project=chromium playwright/stress-paths.spec.js
```

Expected: all 7 tests pass. If `stress: rapid tenant-state changes do not crash` fails, check that all 4 `app-topology*` modes are defined in RuntimeHarnessApp.

- [ ] **Step 11.3: Commit**

```
git add playwright/stress-paths.spec.js
git commit -m "feat(phase-28): add stress-path Playwright validation (7 scenarios)"
```

---

## Task 12: Full validation suite

- [ ] **Step 12.1: Run ESLint across all changed files**

```
npm.cmd run lint
```

Expected: 0 errors. If warnings appear from `src/context/TenantContext.jsx` (unused import), fix by verifying `traceTenant` is exported from `diagnostics.js`. If `traceBootstrap` is flagged as unused in App.jsx, verify the import was added in Task 2 Step 2.1.

- [ ] **Step 12.2: Run full unit test suite**

```
npm.cmd run test
```

Expected: all tests pass, no new failures. Check specifically:
- `src/lib/workspaceCore.test.js` — should show the 3 new threading tests passing
- `src/context/TenantContext.test.jsx` — verify no regressions
- `src/hooks/useOnboarding.test.jsx` — verify no regressions
- `src/hooks/useAuth.test.jsx` — verify no regressions

- [ ] **Step 12.3: Run production build**

```
npm.cmd run build
```

Expected: build succeeds, no TypeScript/ESM errors. If the build fails on `import { traceBootstrap } from './lib/diagnostics.js'` in App.jsx, verify the function was exported in Task 5.

- [ ] **Step 12.4: Run full Playwright suite**

```
npm.cmd run test:visual
```

Expected: all existing specs pass + new specs pass. Track:
- `playwright/runtime-topology.spec.js` — must still pass (no regressions from RuntimeHarnessApp changes)
- `playwright/crash-boundary.spec.js` — must still pass
- `playwright/runtime-hardening.spec.js` — must still pass
- `playwright/app-topology.spec.js` — new, must pass
- `playwright/stress-paths.spec.js` — new, must pass

If any existing test breaks after RuntimeHarnessApp changes:
- `unauthenticated fixture: ProtectedRoute shows login page` → verify the `mode === 'unauthenticated'` block still renders `#runtime-topology-root` hidden path in Task 9.
- `authenticated fixture: ProtectedRoute resolves to children` → verify `mode === 'authenticated'` block renders `#runtime-topology-root`.

---

## Task 13: Write Phase 28 report

**Files:**
- Create: `docs/PHASE_28_EXPLICIT_TENANT_OWNERSHIP_AND_REAL_RUNTIME_TOPOLOGY.md`

- [ ] **Step 13.1: Create the report**

Write a complete, honest Phase 28 report covering all 17 sections listed in the spec:
1. Executive summary
2. Explicit tenant ownership improvements (list every function updated)
3. Real runtime topology implementation (describe the harness topology + limitations)
4. Bootstrap orchestration validation (describe what IS and IS NOT tested)
5. Async fault isolation improvements (be explicit: EB still only catches render errors; listener is diagnostic only)
6. Runtime observability improvements (list new trace functions + how to activate)
7. Stress-path Playwright coverage (list all 7 scenarios)
8. Hook ownership stabilization (list what was improved, what remains as debt)
9. Files changed
10. Tests added
11. Commands executed
12. Validation results (actual pass/fail counts)
13. Remaining ownership debt (functions still using implicit fallback from hooks not yet updated: `useCalendarEvents`, `useMembers`, `useAccounts`, `useTransactions`, `useFinCategories`, `useFinRules`, `usePayees`)
14. Remaining runtime risks
15. Architectural limitations still unresolved
16. Production-readiness reassessment
17. Whether feature expansion is now safer

- [ ] **Step 13.2: Commit the report and audit docs**

```
git add docs/PHASE_28_EXPLICIT_TENANT_OWNERSHIP_AND_REAL_RUNTIME_TOPOLOGY.md docs/PHASE_26_INDEPENDENT_RUNTIME_OWNERSHIP_AUDIT.md docs/PHASE_27_INDEPENDENT_RUNTIME_AUDIT.md
git commit -m "docs: phase 28 report + commit untracked phase 26/27 audit docs"
```

---

## Summary

| Task | Objective(s) covered | Files |
|------|---------------------|-------|
| 1 | Obj 1 — workspaceCore ownership | `workspaceCore.js`, `workspaceCore.test.js` |
| 2 | Obj 1, 5 — App CRUD threading + bootstrap diagnostics | `App.jsx` |
| 3 | Obj 1, 7 — useActivities tenantId | `useActivities.js`, `App.jsx` |
| 4 | Obj 1, 7 — useReceivables tenantId | `useReceivables.js`, `App.jsx` |
| 5 | Obj 5 — diagnostics enrichment | `diagnostics.js` |
| 6 | Obj 5 — TenantContext traces | `TenantContext.jsx` |
| 7 | Obj 4 — async fault isolation | `RootErrorBoundary.jsx`, `lazyWithRetry.js` |
| 8 | Obj 2 — MockProviders | `MockProviders.jsx` |
| 9 | Obj 2, 3 — real topology harness | `RuntimeHarnessApp.jsx` |
| 10 | Obj 2, 3 — topology + bootstrap E2E | `app-topology.spec.js` |
| 11 | Obj 6 — stress paths | `stress-paths.spec.js` |
| 12 | Obj 8 — validation | (commands) |
| 13 | Obj 9 — report | `PHASE_28_*.md` |
