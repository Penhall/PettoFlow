import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingVersion } from './onboardingState.js'
import { ONBOARDING_CHECKLIST, QUICK_ACTIONS, TUTORIAL_CATALOG } from './tutorialCatalog.js'

describe('onboarding state contract', () => {
  it('defines stable default version and experience levels', () => {
    expect(getDefaultOnboardingVersion()).toBe('2026.05')
  })

  it('defines stable tutorial ids and quick actions', () => {
    expect(TUTORIAL_CATALOG.find((item) => item.id === 'getting-started.clients')).toBeTruthy()
    expect(ONBOARDING_CHECKLIST.find((item) => item.id === 'create-first-client')).toBeTruthy()
    expect(QUICK_ACTIONS.find((item) => item.id === 'create-client')).toBeTruthy()
  })
})
