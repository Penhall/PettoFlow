import { expect, test } from '@playwright/test'

const surfaces = [
  { name: 'tasks', path: '/?visual-regression=1&surface=tasks' },
  { name: 'finance', path: '/?visual-regression=1&surface=finance' },
  { name: 'activities', path: '/?visual-regression=1&surface=activities' },
  { name: 'dashboard', path: '/?visual-regression=1&surface=dashboard' },
  { name: 'clients', path: '/?visual-regression=1&surface=clients' },
  { name: 'team', path: '/?visual-regression=1&surface=team' },
  { name: 'calendar', path: '/?visual-regression=1&surface=calendar' },
  { name: 'record-sidebar', path: '/?visual-regression=1&surface=recordSidebar' },
  { name: 'client-profile-modal', path: '/?visual-regression=1&surface=clientProfileModal' },
]

for (const surface of surfaces) {
  test(`visual baseline: ${surface.name}`, async ({ page }) => {
    await page.goto(surface.path)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot(`${surface.name}.png`, {
      fullPage: true,
    })
  })
}
