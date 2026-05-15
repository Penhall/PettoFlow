import { CURRENT_ONBOARDING_VERSION } from './onboardingState.js'
import { VISUAL_FIXTURES } from '../visual/fixtures.js'
import { ACTIVE_TENANT_STORAGE_KEY } from './activeTenant.js'

const isDev = import.meta.env.DEV
const FIXTURE_FLAG = 'runtime-fixture'
const RUNTIME_FIXTURE_KEY = '__NEXUS_RUNTIME_FIXTURE__'

const FIXTURE_USER = {
  id: 'runtime-user-1',
  email: 'ops@nexuscrm.test',
}

const FIXTURE_SESSION = {
  access_token: 'runtime-fixture-access-token',
  refresh_token: 'runtime-fixture-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: FIXTURE_USER,
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readUrl() {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href)
}

export function isRuntimeFixtureMode() {
  if (!isDev || typeof window === 'undefined') return false
  return readUrl()?.searchParams.get(FIXTURE_FLAG) === '1'
}

function readScenario() {
  return readUrl()?.searchParams.get('runtime-scenario') || 'default'
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createTenant(id, name, role = 'owner') {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    role,
    membershipId: `${id}-membership`,
    membershipStatus: 'active',
    ownerUserId: FIXTURE_USER.id,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-15T10:00:00Z',
  }
}

function buildWorkspaceFixtures() {
  const atlasTenantId = 'fixture-tenant-1'
  const borealTenantId = 'fixture-tenant-2'
  const atlas = clone(VISUAL_FIXTURES)
  const boreal = clone(VISUAL_FIXTURES)

  boreal.tasks = boreal.tasks.map((task) => ({
    ...task,
    id: task.id + 10000,
    title: `${task.title} • Boreal`,
    client_id: task.client_id ? task.client_id + 1000 : task.client_id,
  }))
  boreal.columns = boreal.columns.map((column) => ({ ...column, id: column.id + 100 }))
  boreal.team = [
    { id: 41, name: 'Bruna Melo', role: 'Operacoes', status: 'Ativo', email: 'bruna@boreal.test', company_size: '11-50 pessoas' },
    { id: 42, name: 'Rafael Luz', role: 'Vendas', status: 'Ativo', email: 'rafael@boreal.test', company_size: '11-50 pessoas' },
  ]
  boreal.clients = [
    { id: 1101, name: 'Boreal Holdings', industry: 'Energia', projects: 1, revenue: 'R$ 130.000', status: 'Ativo', email: 'comercial@boreal-holdings.test', phone: '(41) 95555-1111', company_size: '51-200 pessoas' },
    { id: 1102, name: 'Delta Freight', industry: 'Logistica', projects: 2, revenue: 'R$ 74.000', status: 'Em negociacao', email: 'ops@delta.test', phone: '(51) 94444-2222', company_size: '11-50 pessoas' },
  ]
  boreal.activities = boreal.activities.map((activity) => ({
    ...activity,
    id: activity.id + 10000,
    title: `${activity.title} • Boreal`,
  }))
  boreal.activityTemplates = boreal.activityTemplates.map((template) => ({ ...template, id: template.id + 10000 }))
  boreal.accounts = boreal.accounts.map((account) => ({ ...account, id: account.id + 10000 }))
  boreal.payees = boreal.payees.map((payee) => ({ ...payee, id: payee.id + 10000 }))
  boreal.finCategoryGroups = boreal.finCategoryGroups.map((group) => ({ ...group, id: group.id + 10000 }))
  boreal.finCategories = boreal.finCategories.map((category) => ({ ...category, id: category.id + 10000, group_id: category.group_id + 10000 }))
  boreal.finRules = boreal.finRules.map((rule) => ({ ...rule, id: rule.id + 10000, name: `${rule.name} Boreal` }))
  boreal.receivables = boreal.receivables.map((receivable) => ({
    ...receivable,
    id: receivable.id + 10000,
    task_id: receivable.task_id ? receivable.task_id + 10000 : null,
    activity_id: receivable.activity_id ? receivable.activity_id + 10000 : null,
    target_account_id: receivable.target_account_id + 10000,
    tasks: receivable.tasks ? { ...receivable.tasks, title: `${receivable.tasks.title} • Boreal` } : null,
    activities: receivable.activities ? { ...receivable.activities, title: `${receivable.activities.title} • Boreal` } : null,
  }))
  boreal.transactions = boreal.transactions.map((transaction) => ({
    ...transaction,
    id: transaction.id + 10000,
    account_id: transaction.account_id + 10000,
    category_id: transaction.category_id + 10000,
    payee_id: transaction.payee_id + 10000,
    related_to: (transaction.related_to || []).map((relation) => ({
      ...relation,
      id: relation.type === 'client' ? relation.id + 1000 : relation.id,
    })),
  }))
  boreal.interactionLogs = {
    1101: [
      { id: 2101, type: 'Email', notes: 'Cliente aprovou expansão piloto.', created_at: '2026-05-08T13:00:00Z' },
    ],
  }

  return {
    tenants: [
      createTenant(atlasTenantId, 'Atlas Bio (Demo)'),
      createTenant(borealTenantId, 'Boreal Ops (Demo)'),
    ],
    workspaceByTenant: {
      [atlasTenantId]: atlas,
      [borealTenantId]: boreal,
    },
  }
}

function buildDefaultOnboardingState() {
  return {
    currentOnboardingVersion: CURRENT_ONBOARDING_VERSION,
    completedOnboardingVersion: null,
    lastSeenOnboardingVersion: CURRENT_ONBOARDING_VERSION,
    experienceLevel: 'new',
    tourState: { status: 'completed', last_step: 0 },
    checklistState: { items: {}, initialization_mode: 'guided_seeded' },
    tutorialState: { opened: [], completed: [] },
    dismissState: {},
  }
}

function buildInitialState(scenario = 'default') {
  const { tenants, workspaceByTenant } = buildWorkspaceFixtures()
  const activeTenantId = tenants[0]?.id ?? null
  const onboardingByTenant = Object.fromEntries(
    tenants.map((tenant) => [
      tenant.id,
      {
        state: buildDefaultOnboardingState(),
        initializationMode: 'guided_seeded',
        seedProfile: null,
        delayMs: 0,
        error: null,
      },
    ]),
  )

  const state = {
    auth: {
      session: clone(FIXTURE_SESSION),
      delayMs: 0,
      platformAdmin: false,
      getSessionError: null,
    },
    tenantList: {
      items: tenants,
      delayMs: 0,
      error: null,
    },
    workspace: {
      activeTenantId,
      byTenant: Object.fromEntries(
        Object.entries(workspaceByTenant).map(([tenantId, data]) => [
          tenantId,
          { data, delayMs: 0, error: null },
        ]),
      ),
    },
    onboarding: {
      byTenant: onboardingByTenant,
      events: [],
    },
    ids: {
      task: 50000,
      column: 51000,
      team: 52000,
      client: 53000,
      activity: 54000,
      activityTemplate: 55000,
      receivable: 56000,
      account: 57000,
      payee: 58000,
      finRule: 59000,
      finCategoryGroup: 60000,
      finCategory: 61000,
      transaction: 62000,
      interactionLog: 63000,
    },
  }

  if (scenario === 'delayed-auth') {
    state.auth.delayMs = 350
  }

  if (scenario === 'tenant-loading') {
    state.tenantList.delayMs = 600
  }

  if (scenario === 'tenant-error') {
    state.tenantList.error = 'Erro simulado ao carregar espaços de trabalho.'
  }

  if (scenario === 'bootstrap-error' && activeTenantId) {
    state.workspace.byTenant[activeTenantId].error = 'Erro simulado ao carregar o espaço de trabalho.'
  }

  if (scenario === 'bootstrap-delayed' && activeTenantId) {
    state.workspace.byTenant[activeTenantId].delayMs = 700
  }

  return state
}

function createJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getControllerWindow() {
  return typeof window !== 'undefined' ? window : null
}

function syncStoredActiveTenantId(nextTenantId) {
  const targetWindow = getControllerWindow()
  if (!targetWindow?.localStorage) return
  if (nextTenantId) {
    targetWindow.localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, nextTenantId)
    return
  }
  targetWindow.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)
}

let runtimeState = null
let authSubscribers = new Set()

function ensureState() {
  if (!runtimeState) {
    runtimeState = buildInitialState(readScenario())
  }
  return runtimeState
}

function nextId(key) {
  const state = ensureState()
  state.ids[key] += 1
  return state.ids[key]
}

function getWorkspace(tenantId) {
  const state = ensureState()
  return state.workspace.byTenant[tenantId]?.data ?? null
}

function getWorkspaceConfig(tenantId) {
  const state = ensureState()
  return state.workspace.byTenant[tenantId] ?? null
}

function enrichReceivable(workspace, receivable) {
  return {
    ...receivable,
    tasks: receivable.task_id ? workspace.tasks.find((task) => task.id === receivable.task_id) ?? null : null,
    activities: receivable.activity_id ? workspace.activities.find((activity) => activity.id === receivable.activity_id) ?? null : null,
  }
}

function filterTransactions(transactions, query) {
  return transactions.filter((transaction) => {
    if (query.accountId && String(transaction.account_id) !== String(query.accountId)) return false
    if (query.categoryId && String(transaction.category_id) !== String(query.categoryId)) return false
    if (query.needsReview !== undefined && String(Boolean(transaction.needs_review)) !== String(Boolean(query.needsReview))) return false
    if (query.cleared !== undefined && String(Boolean(transaction.cleared)) !== String(Boolean(query.cleared))) return false
    if (query.onlyNegative !== undefined && Boolean(query.onlyNegative) && Number(transaction.amount) >= 0) return false
    if (query.dateFrom && transaction.date < query.dateFrom) return false
    if (query.dateTo && transaction.date > query.dateTo) return false

    if (query.relatedType && query.relatedId) {
      const match = Array.isArray(transaction.related_to) && transaction.related_to.some(
        (relation) => relation.type === query.relatedType && String(relation.id) === String(query.relatedId),
      )
      if (!match) return false
    }

    return true
  })
}

function mergeOnboardingState(current, patch) {
  return {
    ...current,
    ...patch,
    tourState: patch.tourState ?? current.tourState,
    checklistState: patch.checklistState ?? current.checklistState,
    tutorialState: patch.tutorialState ?? current.tutorialState,
    dismissState: patch.dismissState ?? current.dismissState,
  }
}

function createController() {
  return {
    getState: () => clone(ensureState()),
    reset: (scenario = 'default') => {
      runtimeState = buildInitialState(scenario)
      syncStoredActiveTenantId(runtimeState.tenantList.items[0]?.id ?? null)
      const nextSession = runtimeState.auth.session
      authSubscribers.forEach((callback) => callback('TOKEN_REFRESHED', nextSession))
      return clone(runtimeState)
    },
    setAuth: (nextAuth) => {
      const state = ensureState()
      state.auth = { ...state.auth, ...nextAuth }
      return clone(state.auth)
    },
    emitAuth: (event, nextSession = undefined) => {
      const state = ensureState()
      state.auth.session = nextSession === undefined ? state.auth.session : nextSession
      authSubscribers.forEach((callback) => callback(event, state.auth.session))
      return clone(state.auth)
    },
    setTenantList: (nextConfig) => {
      const state = ensureState()
      state.tenantList = { ...state.tenantList, ...nextConfig }
      return clone(state.tenantList)
    },
    setWorkspace: (tenantId, nextConfig) => {
      const state = ensureState()
      state.workspace.byTenant[tenantId] = {
        ...state.workspace.byTenant[tenantId],
        ...nextConfig,
        data: nextConfig?.data ? clone(nextConfig.data) : state.workspace.byTenant[tenantId]?.data,
      }
      return clone(state.workspace.byTenant[tenantId])
    },
    setOnboarding: (tenantId, nextConfig) => {
      const state = ensureState()
      state.onboarding.byTenant[tenantId] = {
        ...state.onboarding.byTenant[tenantId],
        ...nextConfig,
        state: nextConfig?.state ? clone(nextConfig.state) : state.onboarding.byTenant[tenantId]?.state,
      }
      return clone(state.onboarding.byTenant[tenantId])
    },
  }
}

export function initializeRuntimeFixture() {
  if (!isRuntimeFixtureMode()) return null
  const targetWindow = getControllerWindow()
  if (!targetWindow) return null
  const state = ensureState()
  syncStoredActiveTenantId(state.tenantList.items[0]?.id ?? null)
  if (!targetWindow[RUNTIME_FIXTURE_KEY]) {
    targetWindow[RUNTIME_FIXTURE_KEY] = createController()
  }
  return state
}

export function getRuntimeFixtureController() {
  if (!isRuntimeFixtureMode()) return null
  const targetWindow = getControllerWindow()
  if (!targetWindow) return null
  initializeRuntimeFixture()
  return targetWindow[RUNTIME_FIXTURE_KEY] ?? null
}

export function getRuntimeFixtureSupabase() {
  if (!isRuntimeFixtureMode()) return null
  initializeRuntimeFixture()

  return {
    auth: {
      async getSession() {
        const state = ensureState()
        if (state.auth.delayMs > 0) {
          await delay(state.auth.delayMs)
        }
        if (state.auth.getSessionError) {
          return {
            data: { session: null },
            error: new Error(state.auth.getSessionError),
          }
        }
        return {
          data: { session: state.auth.session },
          error: null,
        }
      },
      onAuthStateChange(callback) {
        authSubscribers.add(callback)
        return {
          data: {
            subscription: {
              unsubscribe() {
                authSubscribers.delete(callback)
              },
            },
          },
        }
      },
      async signInWithPassword({ email }) {
        const state = ensureState()
        state.auth.session = {
          ...clone(FIXTURE_SESSION),
          user: { ...FIXTURE_USER, email: email || FIXTURE_USER.email },
        }
        authSubscribers.forEach((callback) => callback('SIGNED_IN', state.auth.session))
        return { data: { session: state.auth.session }, error: null }
      },
      async signUp({ email, options }) {
        const state = ensureState()
        state.auth.session = {
          ...clone(FIXTURE_SESSION),
          user: {
            ...FIXTURE_USER,
            email: email || FIXTURE_USER.email,
            user_metadata: options?.data ?? {},
          },
        }
        authSubscribers.forEach((callback) => callback('SIGNED_IN', state.auth.session))
        return { data: { session: state.auth.session, user: state.auth.session.user }, error: null }
      },
      async signOut() {
        const state = ensureState()
        state.auth.session = null
        authSubscribers.forEach((callback) => callback('SIGNED_OUT', null))
        return { error: null }
      },
    },
    async rpc(name) {
      const state = ensureState()
      if (name === 'is_current_user_platform_admin') {
        return { data: state.auth.platformAdmin, error: null }
      }
      return { data: null, error: null }
    },
  }
}

async function parseBody(options) {
  if (!options?.body) return null
  try {
    return JSON.parse(options.body)
  } catch {
    return null
  }
}

function getTenantIdFromOptions(options) {
  return options?.tenantId ?? null
}

export async function handleRuntimeFixtureRequest(url, options = {}) {
  if (!isRuntimeFixtureMode()) return null

  initializeRuntimeFixture()
  const state = ensureState()
  const parsedUrl = new URL(url)
  const { pathname, searchParams } = parsedUrl
  const method = (options.method || 'GET').toUpperCase()
  const tenantId = getTenantIdFromOptions(options)

  if (pathname.endsWith('/functions/v1/tenant-core/tenants') && method === 'GET') {
    if (state.tenantList.delayMs > 0) await delay(state.tenantList.delayMs)
    if (state.tenantList.error) {
      return createJsonResponse({ error: state.tenantList.error }, 500)
    }
    return createJsonResponse({ items: clone(state.tenantList.items) })
  }

  if (pathname.endsWith('/functions/v1/tenant-core/tenants') && method === 'POST') {
    const body = await parseBody(options)
    const tenant = createTenant(`fixture-tenant-${nextId('client')}`, body?.name || 'Novo workspace')
    state.tenantList.items.push(tenant)
    state.workspace.byTenant[tenant.id] = {
      data: clone(VISUAL_FIXTURES),
      delayMs: 0,
      error: null,
    }
    state.onboarding.byTenant[tenant.id] = {
      state: buildDefaultOnboardingState(),
      initializationMode: 'guided_seeded',
      seedProfile: null,
      delayMs: 0,
      error: null,
    }
    return createJsonResponse({ tenant })
  }

  const onboardingMatch = pathname.match(/\/functions\/v1\/tenant-core\/tenants\/([^/]+)\/onboarding$/)
  if (onboardingMatch) {
    const fixture = state.onboarding.byTenant[onboardingMatch[1]]
    if (!fixture) return createJsonResponse({ error: 'Tenant não encontrado' }, 404)
    if (fixture.delayMs > 0) await delay(fixture.delayMs)
    if (fixture.error) return createJsonResponse({ error: fixture.error }, 500)

    if (method === 'GET') {
      return createJsonResponse({
        state: clone(fixture.state),
        initializationMode: fixture.initializationMode,
        seedProfile: fixture.seedProfile,
      })
    }

    if (method === 'PATCH') {
      const body = await parseBody(options)
      fixture.state = mergeOnboardingState(fixture.state, body || {})
      return createJsonResponse({ state: clone(fixture.state) })
    }
  }

  const onboardingEventMatch = pathname.match(/\/functions\/v1\/tenant-core\/tenants\/([^/]+)\/onboarding\/events$/)
  if (onboardingEventMatch && method === 'POST') {
    const body = await parseBody(options)
    state.onboarding.events.unshift({
      id: nextId('interactionLog'),
      tenant_id: onboardingEventMatch[1],
      ...body,
      created_at: new Date().toISOString(),
    })
    return createJsonResponse({ ok: true })
  }

  if (pathname.endsWith('/functions/v1/invite-member/accept') && method === 'POST') {
    return createJsonResponse({ ok: true })
  }

  if (pathname.includes('/functions/v1/workspace-core/')) {
    const workspace = getWorkspace(tenantId)
    const workspaceConfig = getWorkspaceConfig(tenantId)
    if (!workspace || !workspaceConfig) {
      return createJsonResponse({ error: 'Tenant não encontrado para workspace-core.' }, 404)
    }
    if (workspaceConfig.delayMs > 0) await delay(workspaceConfig.delayMs)
    if (workspaceConfig.error) {
      return createJsonResponse({ error: workspaceConfig.error }, 500)
    }

    if (pathname.endsWith('/functions/v1/workspace-core/bootstrap') && method === 'GET') {
      return createJsonResponse({
        tasks: clone(workspace.tasks.filter((task) => !task.archived_at)),
        team: clone(workspace.team),
        clients: clone(workspace.clients),
        columns: clone(workspace.columns),
      })
    }

    if (pathname.endsWith('/functions/v1/workspace-core/tasks/archived') && method === 'GET') {
      return createJsonResponse(clone(workspace.tasks.filter((task) => task.archived_at)))
    }

    const taskArchiveMatch = pathname.match(/\/functions\/v1\/workspace-core\/tasks\/([^/]+)\/archive$/)
    if (taskArchiveMatch && method === 'POST') {
      const task = workspace.tasks.find((item) => String(item.id) === taskArchiveMatch[1])
      if (!task) return createJsonResponse({ error: 'Tarefa não encontrada' }, 404)
      task.archived_at = new Date().toISOString()
      return createJsonResponse(clone(task))
    }

    const taskRestoreMatch = pathname.match(/\/functions\/v1\/workspace-core\/tasks\/([^/]+)\/restore$/)
    if (taskRestoreMatch && method === 'POST') {
      const task = workspace.tasks.find((item) => String(item.id) === taskRestoreMatch[1])
      if (!task) return createJsonResponse({ error: 'Tarefa não encontrada' }, 404)
      task.archived_at = null
      return createJsonResponse(clone(task))
    }

    const taskMatch = pathname.match(/\/functions\/v1\/workspace-core\/tasks(?:\/([^/]+))?$/)
    if (taskMatch) {
      if (method === 'POST') {
        const body = await parseBody(options)
        const created = { ...body, id: nextId('task') }
        workspace.tasks.unshift(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && taskMatch[1]) {
        const body = await parseBody(options)
        const task = workspace.tasks.find((item) => String(item.id) === taskMatch[1])
        if (!task) return createJsonResponse({ error: 'Tarefa não encontrada' }, 404)
        Object.assign(task, body || {})
        return createJsonResponse(clone(task))
      }
      if (method === 'DELETE' && taskMatch[1]) {
        const index = workspace.tasks.findIndex((item) => String(item.id) === taskMatch[1])
        if (index >= 0) workspace.tasks.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/columns') && method === 'POST') {
      const body = await parseBody(options)
      const created = { ...body, id: nextId('column') }
      workspace.columns.push(created)
      return createJsonResponse(clone(created))
    }

    const columnMatch = pathname.match(/\/functions\/v1\/workspace-core\/columns\/([^/]+)$/)
    if (columnMatch && method === 'DELETE') {
      const index = workspace.columns.findIndex((item) => String(item.id) === columnMatch[1])
      if (index >= 0) workspace.columns.splice(index, 1)
      return createJsonResponse({ ok: true })
    }

    const teamMatch = pathname.match(/\/functions\/v1\/workspace-core\/team(?:\/([^/]+))?$/)
    if (teamMatch) {
      if (method === 'GET') return createJsonResponse(clone(workspace.team))
      if (method === 'POST' || method === 'PATCH') {
        const body = await parseBody(options)
        if (body?.id) {
          const member = workspace.team.find((item) => String(item.id) === String(body.id))
          if (!member) return createJsonResponse({ error: 'Membro não encontrado' }, 404)
          Object.assign(member, body)
          return createJsonResponse(clone(member))
        }
        const created = { ...body, id: nextId('team') }
        workspace.team.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'DELETE' && teamMatch[1]) {
        const index = workspace.team.findIndex((item) => String(item.id) === teamMatch[1])
        if (index >= 0) workspace.team.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    const clientMatch = pathname.match(/\/functions\/v1\/workspace-core\/clients(?:\/([^/]+))?$/)
    if (clientMatch) {
      if (method === 'POST' || method === 'PATCH') {
        const body = await parseBody(options)
        if (body?.id) {
          const client = workspace.clients.find((item) => String(item.id) === String(body.id))
          if (!client) return createJsonResponse({ error: 'Cliente não encontrado' }, 404)
          Object.assign(client, body)
          return createJsonResponse(clone(client))
        }
        const created = { ...body, id: nextId('client') }
        workspace.clients.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'DELETE' && clientMatch[1]) {
        const index = workspace.clients.findIndex((item) => String(item.id) === clientMatch[1])
        if (index >= 0) workspace.clients.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/activities') && method === 'GET') {
      return createJsonResponse(clone(workspace.activities))
    }

    const activityMatch = pathname.match(/\/functions\/v1\/workspace-core\/activities(?:\/([^/]+))?$/)
    if (activityMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('activity') }
        workspace.activities.unshift(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && activityMatch[1]) {
        const activity = workspace.activities.find((item) => String(item.id) === activityMatch[1])
        if (!activity) return createJsonResponse({ error: 'Atividade não encontrada' }, 404)
        Object.assign(activity, body || {})
        return createJsonResponse(clone(activity))
      }
      if (method === 'DELETE' && activityMatch[1]) {
        const index = workspace.activities.findIndex((item) => String(item.id) === activityMatch[1])
        if (index >= 0) workspace.activities.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/activity-templates') && method === 'GET') {
      return createJsonResponse(clone(workspace.activityTemplates))
    }

    const activityTemplateMatch = pathname.match(/\/functions\/v1\/workspace-core\/activity-templates(?:\/([^/]+))?$/)
    if (activityTemplateMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('activityTemplate') }
        workspace.activityTemplates.unshift(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && activityTemplateMatch[1]) {
        const template = workspace.activityTemplates.find((item) => String(item.id) === activityTemplateMatch[1])
        if (!template) return createJsonResponse({ error: 'Modelo não encontrado' }, 404)
        Object.assign(template, body || {})
        return createJsonResponse(clone(template))
      }
      if (method === 'DELETE' && activityTemplateMatch[1]) {
        const index = workspace.activityTemplates.findIndex((item) => String(item.id) === activityTemplateMatch[1])
        if (index >= 0) workspace.activityTemplates.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/receivables') && method === 'GET') {
      return createJsonResponse(workspace.receivables.map((receivable) => enrichReceivable(workspace, receivable)))
    }

    const receivableMatch = pathname.match(/\/functions\/v1\/workspace-core\/receivables(?:\/([^/]+))?$/)
    if (receivableMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('receivable'), created_at: new Date().toISOString() }
        workspace.receivables.unshift(created)
        return createJsonResponse(enrichReceivable(workspace, created))
      }
      if (method === 'PATCH' && receivableMatch[1]) {
        const receivable = workspace.receivables.find((item) => String(item.id) === receivableMatch[1])
        if (!receivable) return createJsonResponse({ error: 'Recebível não encontrado' }, 404)
        Object.assign(receivable, body || {})
        return createJsonResponse(enrichReceivable(workspace, receivable))
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/accounts') && method === 'GET') {
      return createJsonResponse(clone(workspace.accounts))
    }

    if (pathname.endsWith('/functions/v1/workspace-core/accounts/active') && method === 'GET') {
      return createJsonResponse(clone(workspace.accounts.filter((account) => account.is_active)))
    }

    const accountMatch = pathname.match(/\/functions\/v1\/workspace-core\/accounts(?:\/([^/]+))?$/)
    if (accountMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('account') }
        workspace.accounts.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && accountMatch[1]) {
        const account = workspace.accounts.find((item) => String(item.id) === accountMatch[1])
        if (!account) return createJsonResponse({ error: 'Conta não encontrada' }, 404)
        Object.assign(account, body || {})
        return createJsonResponse(clone(account))
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/payees') && method === 'GET') {
      return createJsonResponse(clone(workspace.payees))
    }

    const payeeMatch = pathname.match(/\/functions\/v1\/workspace-core\/payees(?:\/([^/]+))?$/)
    if (payeeMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('payee') }
        workspace.payees.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && payeeMatch[1]) {
        const payee = workspace.payees.find((item) => String(item.id) === payeeMatch[1])
        if (!payee) return createJsonResponse({ error: 'Favorecido não encontrado' }, 404)
        Object.assign(payee, body || {})
        return createJsonResponse(clone(payee))
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/fin-rules') && method === 'GET') {
      return createJsonResponse(clone(workspace.finRules))
    }

    const finRuleMatch = pathname.match(/\/functions\/v1\/workspace-core\/fin-rules(?:\/([^/]+))?$/)
    if (finRuleMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('finRule') }
        workspace.finRules.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && finRuleMatch[1]) {
        const rule = workspace.finRules.find((item) => String(item.id) === finRuleMatch[1])
        if (!rule) return createJsonResponse({ error: 'Regra não encontrada' }, 404)
        Object.assign(rule, body || {})
        return createJsonResponse(clone(rule))
      }
      if (method === 'DELETE' && finRuleMatch[1]) {
        const index = workspace.finRules.findIndex((item) => String(item.id) === finRuleMatch[1])
        if (index >= 0) workspace.finRules.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/fin-categories') && method === 'GET') {
      return createJsonResponse({
        groups: clone(workspace.finCategoryGroups),
        categories: clone(workspace.finCategories),
      })
    }

    if (pathname.endsWith('/functions/v1/workspace-core/fin-categories/groups') && method === 'POST') {
      const body = await parseBody(options)
      const created = { ...body, id: nextId('finCategoryGroup') }
      workspace.finCategoryGroups.push(created)
      return createJsonResponse(clone(created))
    }

    const finCategoryMatch = pathname.match(/\/functions\/v1\/workspace-core\/fin-categories\/items(?:\/([^/]+))?$/)
    if (finCategoryMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = { ...body, id: nextId('finCategory') }
        workspace.finCategories.push(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && finCategoryMatch[1]) {
        const category = workspace.finCategories.find((item) => String(item.id) === finCategoryMatch[1])
        if (!category) return createJsonResponse({ error: 'Categoria não encontrada' }, 404)
        Object.assign(category, body || {})
        return createJsonResponse(clone(category))
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/transactions') && method === 'GET') {
      return createJsonResponse(clone(filterTransactions(workspace.transactions, Object.fromEntries(searchParams.entries()))))
    }

    const transactionMatch = pathname.match(/\/functions\/v1\/workspace-core\/transactions(?:\/([^/]+))?$/)
    if (transactionMatch && method !== 'GET') {
      const body = await parseBody(options)
      if (method === 'POST') {
        const created = {
          cleared: false,
          created_at: new Date().toISOString(),
          ...body,
          id: nextId('transaction'),
        }
        workspace.transactions.unshift(created)
        return createJsonResponse(clone(created))
      }
      if (method === 'PATCH' && transactionMatch[1]) {
        const transaction = workspace.transactions.find((item) => String(item.id) === transactionMatch[1])
        if (!transaction) return createJsonResponse({ error: 'Transação não encontrada' }, 404)
        Object.assign(transaction, body || {})
        return createJsonResponse(clone(transaction))
      }
      if (method === 'DELETE' && transactionMatch[1]) {
        const index = workspace.transactions.findIndex((item) => String(item.id) === transactionMatch[1])
        if (index >= 0) workspace.transactions.splice(index, 1)
        return createJsonResponse({ ok: true })
      }
    }

    if (pathname.endsWith('/functions/v1/workspace-core/interaction-logs') && method === 'GET') {
      const clientId = searchParams.get('clientId')
      return createJsonResponse(clone(workspace.interactionLogs[clientId] || []))
    }

    if (pathname.endsWith('/functions/v1/workspace-core/interaction-logs') && method === 'POST') {
      const body = await parseBody(options)
      const created = {
        id: nextId('interactionLog'),
        created_at: new Date().toISOString(),
        ...body,
      }
      const clientId = String(body?.client_id)
      workspace.interactionLogs[clientId] = [created, ...(workspace.interactionLogs[clientId] || [])]
      return createJsonResponse(clone(created))
    }
  }

  return null
}
