import { expect, test } from '@playwright/test'

const RT = '/?runtime-fixture=1&runtime-scenario=default'
const FIXTURE_SESSION = {
  access_token: 'runtime-fixture-access-token',
  refresh_token: 'runtime-fixture-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'runtime-user-1', email: 'ops@nexuscrm.test' },
}

async function emitAuth(page, event, nextSession = undefined) {
  await page.evaluate(([nextEvent, session]) => {
    window.__NEXUS_RUNTIME_FIXTURE__.emitAuth(nextEvent, session)
  }, [event, nextSession])
}

async function setWorkspace(page, tenantId, nextConfig) {
  await page.evaluate(([nextTenantId, config]) => {
    window.__NEXUS_RUNTIME_FIXTURE__.setWorkspace(nextTenantId, config)
  }, [tenantId, nextConfig])
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

test.beforeEach(async ({ page }) => {
  await page.goto(RT)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.sidebar-rail')).toBeVisible()
})

test('mounted stress: repeated tenant switching survives inside one runtime tree', async ({ page }) => {
  const selector = page.locator('#tenant-switcher-select')

  for (let i = 0; i < 3; i++) {
    await selector.selectOption('fixture-tenant-2')
    await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops')

    await selector.selectOption('fixture-tenant-1')
    await expect(page.locator('.sidebar-rail__workspace')).toContainText('Atlas Bio')
  }

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('APP_READY')
})

test('mounted stress: auth loss and recovery happen without full page reload', async ({ page }) => {
  await emitAuth(page, 'SIGNED_OUT', null)
  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')

  await emitAuth(page, 'SIGNED_IN', FIXTURE_SESSION)

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('APP_READY')
})

test('mounted stress: rapid route transitions survive inside the mounted app', async ({ page }) => {
  const labels = [/dashboard/i, /tarefas/i, /atividades/i, /finan/i, /clientes/i, /time/i, /calend/i, /tarefas/i]

  for (const label of labels) {
    await navigateTo(page, label)
  }

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('mounted stress: repeated lazy-route transitions keep the shell mounted', async ({ page }) => {
  const labels = [/finan/i, /atividades/i, /clientes/i, /time/i, /calend/i, /finan/i, /atividades/i]

  for (const label of labels) {
    await navigateTo(page, label)
    await expect(page.locator('.sidebar-rail')).toBeVisible()
    await expect(page.locator('.topbar-shell')).toBeVisible()
  }

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('mounted stress: overlay interruptions during transitions do not crash the app', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await expect(page.locator('.command-palette')).toBeVisible()
  await page.getByRole('button', { name: /nova atividade/i }).click()
  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await navigateTo(page, /finan/i)

  await expect(page.locator('.topbar-shell')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('mounted stress: onboarding mutation during navigation remains stable', async ({ page }) => {
  await navigateTo(page, /dashboard/i)
  await expect(page.locator('body')).toContainText('Primeiros passos')
  await page.getByRole('button', { name: /dispensar painel de onboarding/i }).click()
  await navigateTo(page, /tarefas/i)
  await navigateTo(page, /dashboard/i)

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('mounted stress: bootstrap retry storms recover once the backend stabilizes', async ({ page }) => {
  const selector = page.locator('#tenant-switcher-select')

  await setWorkspace(page, 'fixture-tenant-1', { error: 'Erro simulado ao carregar o espaco de trabalho.' })
  await selector.selectOption('fixture-tenant-2')
  await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops')
  await selector.selectOption('fixture-tenant-1')

  await expect(page.locator('body')).toContainText('Tentar novamente')

  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /tentar novamente/i }).click()
    await expect(page.locator('body')).toContainText('Tentar novamente')
  }

  await setWorkspace(page, 'fixture-tenant-1', { error: null, delayMs: 0 })
  await page.getByRole('button', { name: /tentar novamente/i }).click()

  await expect(page.locator('.sidebar-rail')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('APP_READY')
})

test('mounted stress: concurrent startup interruptions do not leave stale shell state behind', async ({ page }) => {
  const selector = page.locator('#tenant-switcher-select')

  await setWorkspace(page, 'fixture-tenant-1', { delayMs: 600 })
  await setWorkspace(page, 'fixture-tenant-2', { delayMs: 600 })

  await selector.selectOption('fixture-tenant-2')
  await selector.selectOption('fixture-tenant-1')
  await selector.selectOption('fixture-tenant-2')

  await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops', { timeout: 5000 })
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('APP_READY')
})

test('mounted stress: auth invalidation during lazy transition returns runtime to BOOTSTRAP_IDLE', async ({ page }) => {
  await navigateTo(page, /finan/i)
  await emitAuth(page, 'SIGNED_OUT', null)

  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__NEXUS_RUNTIME_PHASE__)).toBe('BOOTSTRAP_IDLE')
})

test('mounted stress: stale team refresh does not commit across tenant switching', async ({ page }) => {
  await navigateTo(page, /time/i)
  await setWorkspace(page, 'fixture-tenant-1', { delayMs: 350 })

  await page.getByRole('button', { name: /novo membro/i }).click()
  await page.locator('.modal-form input').nth(0).fill('Atlas Stale Member')
  await page.locator('.modal-form input').nth(1).fill('Operacoes')
  await page.locator('.modal-form').evaluate((form) => form.requestSubmit())

  await page.locator('#tenant-switcher-select').selectOption('fixture-tenant-2')
  await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops')

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window.__NEXUS_DIAG_EVENTS__ || []).filter(
            (event) => event.kind === 'async' && event.label === 'app.team-refresh' && event.phase === 'cancel',
          ).length,
        ),
      { timeout: 3000 },
    )
    .toBeGreaterThan(0)
  await expect(page.locator('body')).toContainText('Bruna Melo')
  await expect(page.locator('body')).not.toContainText('Atlas Stale Member')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('mounted stress: stale client refresh does not commit across tenant switching', async ({ page }) => {
  await navigateTo(page, /clientes/i)
  await setWorkspace(page, 'fixture-tenant-1', { delayMs: 350 })

  await page.getByRole('button', { name: /novo cliente/i }).click()
  await page.locator('.modal-form input').nth(0).fill('Atlas Stale Client')
  await page.locator('.modal-form').evaluate((form) => form.requestSubmit())

  await page.locator('#tenant-switcher-select').selectOption('fixture-tenant-2')
  await expect(page.locator('.sidebar-rail__workspace')).toContainText('Boreal Ops')

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window.__NEXUS_DIAG_EVENTS__ || []).filter(
            (event) => event.kind === 'async' && event.label === 'app.clients-refresh' && event.phase === 'cancel',
          ).length,
        ),
      { timeout: 3000 },
    )
    .toBeGreaterThan(0)
  await expect(page.locator('body')).toContainText('Boreal Holdings')
  await expect(page.locator('body')).not.toContainText('Atlas Stale Client')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
