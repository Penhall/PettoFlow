/**
 * Real app-topology E2E tests — Phase 28.
 *
 * These tests mount the REAL component topology:
 *   AuthContext.Provider > ProtectedRoute > TenantContext.Provider > TenantGate > App
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
