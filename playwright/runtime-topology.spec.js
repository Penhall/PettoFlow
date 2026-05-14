/**
 * Runtime topology E2E tests.
 *
 * These tests validate the REAL ProtectedRoute + auth gating logic by routing
 * through ProtectedRoute with fixture context values — not bypassing it.
 *
 * Contrast with runtime-hardening.spec.js which uses ?visual-regression=1,
 * where VisualRegressionApp is mounted DIRECTLY (ProtectedRoute is skipped).
 * Here, ?runtime-harness=1 mounts RuntimeHarnessApp which renders:
 *   ContextFixtures > ProtectedRoute > children
 *
 * Tests prove:
 *  - ProtectedRoute lets children through when isAuthenticated: true
 *  - ProtectedRoute shows login page when isAuthenticated: false
 *  - Neither path triggers the root error boundary
 *  - No loading screen remains after fixture auth resolves (loading: false from start)
 *
 * Run: npm run test:visual (starts dev server automatically)
 */

import { expect, test } from '@playwright/test'

const RH_AUTH = '/?runtime-harness=1'
const RH_UNAUTH = '/?runtime-harness=1&harness-mode=unauthenticated'

test('authenticated fixture: ProtectedRoute resolves to children', async ({ page }) => {
  await page.goto(RH_AUTH)
  await page.waitForLoadState('networkidle')

  // ProtectedRoute must pass through to the content div
  await expect(page.locator('#runtime-topology-root')).toBeVisible()
  await expect(page.locator('#runtime-topology-root')).toContainText('ProtectedRoute resolved to children')
})

test('authenticated fixture: no root error boundary fires', async ({ page }) => {
  await page.goto(RH_AUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('authenticated fixture: no loading screen visible after fixture resolves', async ({ page }) => {
  await page.goto(RH_AUTH)
  await page.waitForLoadState('networkidle')

  // Fixture injects loading: false immediately — no loading screen expected
  const body = await page.locator('body').textContent()
  expect(body).not.toContain('Carregando NexusCRM...')
})

test('unauthenticated fixture: ProtectedRoute shows login page', async ({ page }) => {
  await page.goto(RH_UNAUTH)
  await page.waitForLoadState('networkidle')

  // isAuthenticated: false → ProtectedRoute renders LoginPage
  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  // Children must NOT be visible
  await expect(page.locator('#runtime-topology-root')).not.toBeVisible()
})

test('unauthenticated fixture: no root error boundary fires', async ({ page }) => {
  await page.goto(RH_UNAUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

test('auth transition: switching from authenticated to unauthenticated shows login', async ({ page }) => {
  // Start authenticated
  await page.goto(RH_AUTH)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#runtime-topology-root')).toBeVisible()

  // Navigate to unauthenticated mode (simulates auth loss / logout)
  await page.goto(RH_UNAUTH)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).toContainText('Entrar no NexusCRM')
  await expect(page.locator('#runtime-topology-root')).not.toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
