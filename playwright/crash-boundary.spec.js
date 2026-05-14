/**
 * RootErrorBoundary intentional crash validation tests.
 *
 * Uses ?runtime-harness=1&harness-mode=crash to mount CrashTestSurface,
 * which throws unconditionally on every render, exercising the full
 * RootErrorBoundary lifecycle:
 *  - Boundary appearance and message content
 *  - Retry button triggers children remount (boundary resets then re-catches)
 *  - After MAX_RETRIES (3), retry button disappears, exhaustion message shown
 *  - Reload button always visible
 *
 * Run: npm run test:visual (starts dev server automatically)
 */

import { expect, test } from '@playwright/test'

const CRASH_URL = '/?runtime-harness=1&harness-mode=crash'

test('crash: root error boundary appears with correct heading', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).toBeVisible()
  await expect(page.locator('.root-error-boundary__title')).toContainText('Algo deu errado')
})

test('crash: reload button is always visible', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary__btn--primary')).toBeVisible()
  await expect(page.locator('.root-error-boundary__btn--primary')).toContainText('Recarregar página')
})

test('crash: retry button is visible before exhaustion', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary__btn--secondary')).toBeVisible()
  await expect(page.locator('.root-error-boundary__btn--secondary')).toContainText('Tentar novamente')
})

test('crash: retry triggers remount — boundary resets and re-catches crash', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).toBeVisible()

  // Click retry — boundary resets (hasError: false), CrashTestSurface throws again,
  // boundary catches again. Net result: error boundary still visible.
  await page.locator('.root-error-boundary__btn--secondary').click()
  await page.waitForTimeout(100)

  await expect(page.locator('.root-error-boundary')).toBeVisible()
})

test('crash: retry button disappears after MAX_RETRIES (3 clicks)', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  const retryBtn = page.locator('.root-error-boundary__btn--secondary')
  const reloadBtn = page.locator('.root-error-boundary__btn--primary')

  // Click retry 3 times
  for (let i = 0; i < 3; i++) {
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()
    await page.waitForTimeout(100)
  }

  // After 3 retries: retry button gone, reload button still present
  await expect(retryBtn).not.toBeVisible()
  await expect(reloadBtn).toBeVisible()
})

test('crash: exhaustion message appears after MAX_RETRIES', async ({ page }) => {
  await page.goto(CRASH_URL)
  await page.waitForLoadState('networkidle')

  const retryBtn = page.locator('.root-error-boundary__btn--secondary')

  for (let i = 0; i < 3; i++) {
    await retryBtn.click()
    await page.waitForTimeout(100)
  }

  await expect(page.locator('.root-error-boundary__description')).toContainText(
    'O erro persiste após múltiplas tentativas',
  )
})
