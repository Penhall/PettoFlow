import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOnboarding } from './useOnboarding.js'

vi.mock('../lib/onboardingApi.js', () => ({
  getOnboardingState: vi.fn(async () => ({
    currentVersion: '2026.05',
    initializationMode: 'guided_seeded',
    state: {
      currentOnboardingVersion: '2026.05',
      checklistState: { items: {} },
      tutorialState: { opened: [], completed: [] },
      tourState: { status: 'not_started' },
      dismissState: {},
      experienceLevel: 'new',
    },
    seedProfile: null,
  })),
  updateOnboardingState: vi.fn(async (_tenantId, payload) => ({
    state: {
      currentOnboardingVersion: '2026.05',
      checklistState: payload.checklistState ?? { items: {} },
      tutorialState: payload.tutorialState ?? { opened: [], completed: [] },
      tourState: payload.tourState ?? { status: 'not_started' },
      dismissState: payload.dismissState ?? {},
      experienceLevel: payload.experienceLevel ?? 'new',
    },
  })),
  recordOnboardingEvent: vi.fn(async () => ({ event: { id: 'evt-1' } })),
}))

describe('useOnboarding', () => {
  it('loads onboarding state for the active tenant', async () => {
    const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.state.currentOnboardingVersion).toBe('2026.05')
    expect(result.current.initializationMode).toBe('guided_seeded')
  })
})
