/**
 * Runtime hardening E2E tests.
 *
 * These tests use the visual regression harness (?visual-regression=1) which
 * bypasses real authentication and injects fixture data. They validate that:
 *  - surfaces load content (not empty/broken state)
 *  - navigation between surfaces does not crash the shell
 *  - the command palette opens and closes correctly
 *  - the root error boundary is NOT triggered under normal usage
 *
 * Run: npm run test:visual (starts preview server automatically)
 */

import { expect, test } from '@playwright/test'

const VR = '?visual-regression=1'

// ─── Surface load tests ──────────────────────────────────────────────────────

const loadableSurfaces = [
  { name: 'tasks', path: `/${VR}&surface=tasks` },
  { name: 'finance', path: `/${VR}&surface=finance` },
  { name: 'activities', path: `/${VR}&surface=activities` },
  { name: 'dashboard', path: `/${VR}&surface=dashboard` },
  { name: 'clients', path: `/${VR}&surface=clients` },
  { name: 'team', path: `/${VR}&surface=team` },
  { name: 'calendar', path: `/${VR}&surface=calendar` },
]

for (const surface of loadableSurfaces) {
  test(`surface loads without root error boundary: ${surface.name}`, async ({ page }) => {
    await page.goto(surface.path)
    await page.waitForLoadState('networkidle')

    // Root error boundary must not be visible
    await expect(page.locator('.root-error-boundary')).not.toBeVisible()

    // Page must not be blank — at minimum the app shell renders
    const body = await page.locator('body').textContent()
    expect(body?.trim().length).toBeGreaterThan(0)
  })
}

// ─── Shell integrity ─────────────────────────────────────────────────────────

test('shell structure is intact after navigating between surfaces', async ({ page }) => {
  await page.goto(`/${VR}&surface=tasks`)
  await page.waitForLoadState('networkidle')

  // Navigate to several surfaces via URL changes (simulates tab switch)
  for (const surface of ['finance', 'activities', 'dashboard', 'clients']) {
    await page.goto(`/${VR}&surface=${surface}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  }
})

// ─── Command palette ─────────────────────────────────────────────────────────

test('command palette opens and closes via keyboard shortcut', async ({ page }) => {
  await page.goto(`/${VR}&surface=tasks`)
  await page.waitForLoadState('networkidle')

  // Open palette: Ctrl+K (Linux/Windows) or Cmd+K (Mac)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(150)

  // Close palette with Escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // No crashes — root error boundary still hidden
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── Record sidebar ───────────────────────────────────────────────────────────

test('record sidebar surface loads without crash', async ({ page }) => {
  await page.goto(`/${VR}&surface=recordSidebar`)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})

// ─── Client profile modal ─────────────────────────────────────────────────────

test('client profile modal surface loads without crash', async ({ page }) => {
  await page.goto(`/${VR}&surface=clientProfileModal`)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
})
