import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboarding } from './useOnboarding.js'

const getOnboardingStateMock = vi.fn()
const updateOnboardingStateMock = vi.fn()
const recordOnboardingEventMock = vi.fn()

vi.mock('../lib/onboardingApi.js', () => ({
  getOnboardingState: (...args) => getOnboardingStateMock(...args),
  updateOnboardingState: (...args) => updateOnboardingStateMock(...args),
  recordOnboardingEvent: (...args) => recordOnboardingEventMock(...args),
}))

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getOnboardingStateMock.mockResolvedValue({
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
    })

    updateOnboardingStateMock.mockImplementation(async (_tenantId, payload) => ({
      state: {
        currentOnboardingVersion: '2026.05',
        checklistState: payload.checklistState ?? { items: {} },
        tutorialState: payload.tutorialState ?? { opened: [], completed: [] },
        tourState: payload.tourState ?? { status: 'not_started' },
        dismissState: payload.dismissState ?? {},
        experienceLevel: payload.experienceLevel ?? 'new',
      },
    }))

    recordOnboardingEventMock.mockResolvedValue({ event: { id: 'evt-1' } })
  })

  it('loads onboarding state for the active tenant', async () => {
    const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.state.currentOnboardingVersion).toBe('2026.05')
    expect(result.current.initializationMode).toBe('guided_seeded')
  })

  it('falls back safely when onboarding state fails to load', async () => {
    getOnboardingStateMock.mockRejectedValueOnce(new Error('falha de onboarding'))

    const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.state.currentOnboardingVersion).toBe('2026.05')
    expect(result.current.state.experienceLevel).toBe('new')
    expect(result.current.initializationMode).toBe('guided_seeded')
  })
})
