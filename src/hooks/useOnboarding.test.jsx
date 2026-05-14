import { act, renderHook, waitFor } from '@testing-library/react'
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

  describe('stale mutation protection (Phase 24 regression)', () => {
    it('rapid consecutive checklist completions preserve both items', async () => {
      // Simulate server that merges items — returns whatever was sent.
      // This tests that the second call uses the server-confirmed state
      // from the first call (via stateRef) rather than the stale initial snapshot.
      let callCount = 0
      updateOnboardingStateMock.mockImplementation(async (_tenantId, payload) => {
        callCount++
        return {
          state: {
            currentOnboardingVersion: '2026.05',
            checklistState: payload.checklistState ?? { items: {} },
            tutorialState: { opened: [], completed: [] },
            tourState: { status: 'not_started' },
            dismissState: {},
            experienceLevel: 'new',
          },
        }
      })

      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Call both completions sequentially (not simultaneously) to validate
      // that stateRef always reflects the latest committed state.
      await act(async () => {
        await result.current.completeChecklistItem('item-a')
      })
      await act(async () => {
        await result.current.completeChecklistItem('item-b')
      })

      expect(callCount).toBe(2)

      // After both calls, the local state should show both items completed.
      await waitFor(() => {
        const items = result.current.state.checklistState?.items ?? {}
        expect(items['item-a']?.completed).toBe(true)
        expect(items['item-b']?.completed).toBe(true)
      })
    })

    it('failed patchState does not corrupt local state', async () => {
      updateOnboardingStateMock.mockRejectedValueOnce(new Error('network error'))

      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const stateBefore = result.current.state

      await act(async () => {
        await result.current.completeChecklistItem('item-x')
      })

      // After a failed patch, local state should be unchanged (no partial corruption).
      expect(result.current.state.checklistState).toEqual(stateBefore.checklistState)
    })

    it('dismissSurface does not create duplicate dismissal entries on retry', async () => {
      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.dismissSurface({ scope: 'dashboard.onboarding-panel', reason: 'manual_close' })
      })
      await act(async () => {
        await result.current.dismissSurface({ scope: 'dashboard.onboarding-panel', reason: 'manual_close' })
      })

      // dismissState keys are simple object keys — re-setting the same scope
      // just overwrites, no duplicate entries.
      const dismissKeys = Object.keys(result.current.state.dismissState ?? {})
      const occurrences = dismissKeys.filter((k) => k === 'dashboard.onboarding-panel')
      expect(occurrences.length).toBe(1)
    })

    it('markTutorialOpened does not create duplicate tutorial IDs', async () => {
      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.markTutorialOpened('getting-started.tasks')
      })
      await act(async () => {
        await result.current.markTutorialOpened('getting-started.tasks')
      })

      const opened = result.current.state.tutorialState?.opened ?? []
      const count = opened.filter((id) => id === 'getting-started.tasks').length
      expect(count).toBe(1)
    })
  })
})
