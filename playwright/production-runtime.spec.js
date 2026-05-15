import { expect, test } from '@playwright/test'

const RT = (scenario = 'default', extra = '') =>
  `/?runtime-fixture=1&runtime-scenario=${scenario}${extra ? `&${extra}` : ''}`

async function setTenantList(page, config) {
  await page.evaluate((nextConfig) => {
    window.__NEXUS_RUNTIME_FIXTURE__.setTenantList(nextConfig)
  }, config)
}

async function setWorkspace(page, tenantId, config) {
  await page.evaluate(([nextTenantId, nextConfig]) => {
    window.__NEXUS_RUNTIME_FIXTURE__.setWorkspace(nextTenantId, nextConfig)
  }, [tenantId, config])
}

async function emitAuth(page, event, nextSession = undefined) {
  await page.evaluate(([nextEvent, session]) => {
    window.__NEXUS_RUNTIME_FIXTURE__.emitAuth(nextEvent, session)
  }, [event, nextSession])
}

async function navigateTo(page, labelMatcher) {
  const target = page.getByRole('button', { name: labelMatcher }).first()
  const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches)
  if (isMobileViewport) {
    await page.getByRole('button', { name: /abrir naveg/i }).click()
    await expect(page.locator('.sidebar-rail--mobile-open')).toBeVisible()
  }
  await target.click()
}

test('production runtime: successful auth hydration mounts the real app shell', async ({ page }) => {
  await page.goto(RT())
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.topbar-shell')).toBeVisible()
  await expect(page.locator('#tenant-switcher-select')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: strict ownership is enabled by default in dev runtime paths', async ({ page }) => {
  await page.goto(RT())
  await page.waitForLoadState('networkidle')

  const strictOwnershipEnabled = await page.evaluate(() => window.__NEXUS_STRICT_OWNERSHIP__ === true)

  expect(strictOwnershipEnabled).toBe(true)
})

test('production runtime: delayed auth hydration shows loading before resolving', async ({ page }) => {
  await page.goto(RT('delayed-auth'), { waitUntil: 'commit' })

  await expect(page.locator('.loading-screen, .auth-card')).toContainText(/Carregando/i)
  await expect(page.locator('.sidebar-rail')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: auth invalidation during bootstrap cancels startup and returns to login', async ({ page }) => {
  await page.goto(RT('bootstrap-delayed'), { waitUntil: 'commit' })
  await expect(page.locator('body')).toContainText('Carregando NexusCRM')

  await emitAuth(page, 'SIGNED_OUT', null)

  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await page.waitForTimeout(900)
  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: tenant loading failure can recover through the real TenantGate retry path', async ({ page }) => {
  await page.goto(RT('tenant-error'))
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Erro ao carregar espaços de trabalho')
  await setTenantList(page, { error: null, delayMs: 0 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: bootstrap failure can recover through App retry without remounting providers', async ({ page }) => {
  await page.goto(RT('bootstrap-error'))
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible()

  await setWorkspace(page, 'fixture-tenant-1', { error: null, delayMs: 0 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.getByRole('button', { name: /tentar novamente/i })).not.toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: startup can target a lazy tab and keep the shell stable while the route resolves', async ({ page }) => {
  await page.goto(RT('bootstrap-delayed', 'tab=financas'), { waitUntil: 'commit' })

  await expect(page.locator('body')).toContainText('Carregando NexusCRM')
  await expect(page.locator('.sidebar-rail')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.topbar-shell')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('production runtime: orchestration phases converge to APP_READY after startup', async ({ page }) => {
  await page.goto(RT('bootstrap-delayed'), { waitUntil: 'commit' })
  await page.waitForLoadState('networkidle')
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('APP_READY')

  const orchestrationPhases = await page.evaluate(() =>
    (window.__NEXUS_DIAG_EVENTS__ || [])
      .filter((event) => event.kind === 'orchestration-transition')
      .map((event) => event.to),
  )

  expect(orchestrationPhases).toContain('AUTH_HYDRATING')
  expect(orchestrationPhases).toContain('TENANT_LOADING')
  expect(orchestrationPhases).toContain('WORKSPACE_LOADING')
  expect(orchestrationPhases.at(-1)).toBe('APP_READY')
})

test('production runtime: strict ownership mode navigates without implicit workspace-core fallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__NEXUS_STRICT_OWNERSHIP__ = true
  })

  await page.goto(RT())
  await page.waitForLoadState('networkidle')

  await navigateTo(page, /dashboard/i)
  await navigateTo(page, /finan/i)
  await navigateTo(page, /atividades/i)
  await navigateTo(page, /clientes/i)
  await navigateTo(page, /time/i)
  await navigateTo(page, /calend/i)

  await page.locator('#tenant-switcher-select').selectOption('fixture-tenant-2')
  await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops')

  const implicitOwnershipEvents = await page.evaluate(() =>
    (window.__NEXUS_DIAG_EVENTS__ || []).filter(
      (event) => event.kind === 'ownership' && event.source === 'implicit',
    ),
  )

  expect(implicitOwnershipEvents).toEqual([])
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
