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

vi.mock('./useRuntimeOrchestration.js', () => ({
  useRuntimeOrchestration: () => ({
    startTransition: vi.fn(),
    completeTransition: vi.fn(),
    phase: 'APP_READY',
  }),
}))

// Stateful mock that merges each partial payload into accumulated server state,
// simulating real PATCH semantics: only provided keys are updated, the server
// returns the full merged state. This matches how updateOnboardingState works
// in production (partial fields → full state response).
function makeEchoMock() {
  let serverState = {
    currentOnboardingVersion: '2026.05',
    checklistState: { items: {} },
    tutorialState: { opened: [], completed: [] },
    tourState: { status: 'not_started' },
    dismissState: {},
    experienceLevel: 'new',
  }
  return async (_tenantId, payload) => {
    if (payload.checklistState !== undefined) serverState = { ...serverState, checklistState: payload.checklistState }
    if (payload.tutorialState !== undefined) serverState = { ...serverState, tutorialState: payload.tutorialState }
    if (payload.tourState !== undefined) serverState = { ...serverState, tourState: payload.tourState }
    if (payload.dismissState !== undefined) serverState = { ...serverState, dismissState: payload.dismissState }
    return { state: { ...serverState } }
  }
}

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

    updateOnboardingStateMock.mockImplementation(makeEchoMock())
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

  describe('Phase 24 regression: stale mutation protection', () => {
    it('rapid consecutive checklist completions preserve both items', async () => {
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

      await act(async () => { await result.current.completeChecklistItem('item-a') })
      await act(async () => { await result.current.completeChecklistItem('item-b') })

      expect(callCount).toBe(2)

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

      await act(async () => { await result.current.completeChecklistItem('item-x') })

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

      const dismissKeys = Object.keys(result.current.state.dismissState ?? {})
      const occurrences = dismissKeys.filter((k) => k === 'dashboard.onboarding-panel')
      expect(occurrences.length).toBe(1)
    })

    it('markTutorialOpened does not create duplicate tutorial IDs', async () => {
      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => { await result.current.markTutorialOpened('getting-started.tasks') })
      await act(async () => { await result.current.markTutorialOpened('getting-started.tasks') })

      const opened = result.current.state.tutorialState?.opened ?? []
      const count = opened.filter((id) => id === 'getting-started.tasks').length
      expect(count).toBe(1)
    })
  })

  describe('Phase 27: committed-state queue — payload computed at execution time', () => {
    it('concurrent checklist completions: second payload includes first confirmed item', async () => {
      // The fix: payload builders run INSIDE the queue after the previous call
      // confirms, so the second builder reads committedStateRef which already has
      // item-a from the server response of the first call.
      const serverCalls = []
      updateOnboardingStateMock.mockImplementation(async (_tenantId, payload) => {
        serverCalls.push(JSON.parse(JSON.stringify(payload)))
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

      // Fire BOTH without awaiting the first — true concurrent dispatch
      await act(async () => {
        const p1 = result.current.completeChecklistItem('item-a')
        const p2 = result.current.completeChecklistItem('item-b')
        await Promise.all([p1, p2])
      })

      expect(serverCalls).toHaveLength(2)
      // The SECOND server call must include item-a (merged from confirmed state)
      const secondCallItems = serverCalls[1]?.checklistState?.items ?? {}
      expect(secondCallItems['item-a']?.completed).toBe(true)
      expect(secondCallItems['item-b']?.completed).toBe(true)
    })

    it('concurrent mixed mutations: dismiss + checklist do not overwrite each other', async () => {
      updateOnboardingStateMock.mockImplementation(makeEchoMock())

      const { result } = renderHook(() => useOnboarding({ tenantId: 'tenant-1', enabled: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        const p1 = result.current.completeChecklistItem('item-a')
        const p2 = result.current.dismissSurface({ scope: 'panel.x', reason: 'manual_close' })
        await Promise.all([p1, p2])
      })

      // Both mutations must be visible in the final state
      const items = result.current.state.checklistState?.items ?? {}
      const dismissed = result.current.state.dismissState ?? {}
      expect(items['item-a']?.completed).toBe(true)
      expect(dismissed['panel.x']?.dismissed).toBe(true)
    })

    it('failed first patch does not block subsequent patches from executing', async () => {
      let callCount = 0
      updateOnboardingStateMock
        .mockRejectedValueOnce(new Error('first patch fails'))
        .mockImplementation(async (_tenantId, payload) => {
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

      await act(async () => {
        await result.current.completeChecklistItem('item-fail')
      })

      // After the failed patch, the queue should drain and subsequent patches execute
      await act(async () => {
        await result.current.completeChecklistItem('item-ok')
      })

      expect(callCount).toBe(1)

      await waitFor(() => {
        const items = result.current.state.checklistState?.items ?? {}
        expect(items['item-ok']?.completed).toBe(true)
      })
    })
  })
})
