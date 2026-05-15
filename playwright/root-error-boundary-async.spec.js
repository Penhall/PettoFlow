import { expect, test } from '@playwright/test'

const ASYNC_REJECTION_URL = '/?runtime-harness=1&harness-mode=async-rejection'
const ASYNC_EVENT_URL = '/?runtime-harness=1&harness-mode=async-event'
const LAZY_REJECT_URL = '/?runtime-harness=1&harness-mode=lazy-reject'

async function getAsyncFaults(page, type) {
  return page.evaluate(
    (nextType) =>
      (window.__NEXUS_DIAG_EVENTS__ || []).filter(
        (event) => event.kind === 'async-fault' && event.type === nextType,
      ),
    type,
  )
}

test('async boundary: unhandled async rejection is classified without crashing the shell', async ({ page }) => {
  await page.goto(ASYNC_REJECTION_URL)
  await page.waitForTimeout(150)

  await expect(page.getByTestId('async-rejection-surface')).toBeVisible()
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  expect((await getAsyncFaults(page, 'unhandled-rejection')).length).toBeGreaterThan(0)
})

test('async boundary: async event failure is classified without pretending the boundary caught it', async ({ page }) => {
  await page.goto(ASYNC_EVENT_URL)
  await page.getByRole('button', { name: /trigger async event failure/i }).click()
  await page.waitForTimeout(150)

  await expect(page.getByTestId('async-event-surface')).toContainText('Triggered.')
  await expect(page.locator('.root-error-boundary')).not.toBeVisible()
  expect((await getAsyncFaults(page, 'async-event')).length).toBeGreaterThan(0)
})

test('async boundary: rejected lazy imports still surface through the root boundary with diagnostics', async ({ page }) => {
  await page.goto(LAZY_REJECT_URL)
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.root-error-boundary')).toBeVisible()
  expect((await getAsyncFaults(page, 'lazy-load-failure')).length).toBeGreaterThan(0)
})
