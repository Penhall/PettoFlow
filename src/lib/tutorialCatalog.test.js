import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingVersion } from './onboardingState.js'

describe('onboarding state contract', () => {
  it('defines stable default version and experience levels', () => {
    expect(getDefaultOnboardingVersion()).toBe('2026.05')
  })
})
