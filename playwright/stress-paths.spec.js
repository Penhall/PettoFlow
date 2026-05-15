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

// ─── 6. Retry after rapid switch ─────────────────────────────────────────────

test('stress: navigating to surface after previous rapid switch does not crash', async ({ page }) => {
  const surfaces = ['finance', 'tasks', 'activities', 'dashboard']
  for (const surface of surfaces) {
    await page.goto(VR(surface), { waitUntil: 'commit' })
  }

  await page.goto(VR('tasks'))
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  await expect(page.locator('.sidebar-rail')).toBeVisible()
})

// ─── 7. Onboarding + navigation overlap ──────────────────────────────────────

test('stress: navigating away from dashboard during onboarding panel load does not crash', async ({ page }) => {
  await page.goto(VR('dashboard'))
  await page.waitForLoadState('networkidle')

  await page.goto(VR('tasks'), { waitUntil: 'commit' })
  await page.goto(VR('activities'), { waitUntil: 'commit' })
  await page.goto(VR('dashboard'))
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
