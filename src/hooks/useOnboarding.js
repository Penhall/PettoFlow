import { useEffect, useRef, useState } from 'react'
import { getOnboardingState, recordOnboardingEvent, updateOnboardingState } from '../lib/onboardingApi.js'
import { CURRENT_ONBOARDING_VERSION } from '../lib/onboardingState.js'
import { ONBOARDING_CHECKLIST, QUICK_ACTIONS, TUTORIAL_CATALOG } from '../lib/tutorialCatalog.js'

function buildFallbackState() {
  return {
    currentOnboardingVersion: CURRENT_ONBOARDING_VERSION,
    completedOnboardingVersion: null,
    lastSeenOnboardingVersion: CURRENT_ONBOARDING_VERSION,
    experienceLevel: 'new',
    tourState: { status: 'not_started', last_step: null },
    checklistState: { items: {}, initialization_mode: 'guided_seeded' },
    tutorialState: { opened: [], completed: [] },
    dismissState: {},
  }
}

function normalizeResponseState(data) {
  return {
    ...buildFallbackState(),
    ...(data || {}),
    tourState: data?.tourState || buildFallbackState().tourState,
    checklistState: data?.checklistState || buildFallbackState().checklistState,
    tutorialState: data?.tutorialState || buildFallbackState().tutorialState,
    dismissState: data?.dismissState || buildFallbackState().dismissState,
  }
}

export function useOnboarding({ tenantId, enabled = true }) {
  const [state, setState] = useState(buildFallbackState())
  const [loading, setLoading] = useState(Boolean(enabled && tenantId))
  const [error, setError] = useState(null)
  const [initializationMode, setInitializationMode] = useState('guided_seeded')
  const [seedProfile, setSeedProfile] = useState(null)

  // committedStateRef tracks the last server-confirmed state.
  // Updated synchronously inside queue execution — before the next queued
  // item runs — so payload builders always receive the latest confirmed state
  // regardless of React render timing.
  const committedStateRef = useRef(state)

  // Serial mutation queue: each enqueued item waits for the previous to settle.
  // Payload is computed via a builder function INSIDE execution so it reads
  // committedStateRef.current AFTER the previous patch confirmed — eliminating
  // stale-payload overwrite even for overlapping rapid mutations.
  const mutationQueue = useRef(Promise.resolve(null))

  useEffect(() => {
    committedStateRef.current = state
  }, [state])

  useEffect(() => {
    if (!enabled || !tenantId) {
      const fallback = buildFallbackState()
      setState(fallback)
      committedStateRef.current = fallback
      setInitializationMode('guided_seeded')
      setSeedProfile(null)
      setError(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getOnboardingState(tenantId)
      .then((data) => {
        if (cancelled) return
        const nextState = normalizeResponseState(data?.state)
        setState(nextState)
        committedStateRef.current = nextState
        setInitializationMode(data?.initializationMode || 'guided_seeded')
        setSeedProfile(data?.seedProfile || null)
      })
      .catch((nextError) => {
        if (cancelled) return
        console.error('Error fetching onboarding state:', nextError)
        setError(nextError)
        const fallback = buildFallbackState()
        setState(fallback)
        committedStateRef.current = fallback
        setInitializationMode('guided_seeded')
        setSeedProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tenantId, enabled])

  // patchState accepts a builder function (current => payload) rather than a
  // static payload object. The builder is called INSIDE the queued execution so
  // it reads committedStateRef.current AFTER the preceding patch has confirmed,
  // guaranteeing correct merge even under concurrent rapid calls.
  const patchState = (buildPayload) => {
    if (!tenantId) return Promise.resolve(null)

    const queued = mutationQueue.current.then(async () => {
      // Compute payload from the latest server-confirmed state at execution time
      const payload = buildPayload(committedStateRef.current)
      try {
        const data = await updateOnboardingState(tenantId, payload)
        const nextState = normalizeResponseState(data?.state)
        // Update synchronously before resolving so the next queued item
        // sees this confirmed state immediately via committedStateRef.current
        committedStateRef.current = nextState
        setState(nextState)
        return nextState
      } catch (nextError) {
        console.error('Error updating onboarding state:', nextError)
        setError(nextError)
        return null
      }
    })

    // Prevent unhandled rejection on the queue reference from a failed patch
    mutationQueue.current = queued.catch(() => null)
    return queued
  }

  const emitEvent = async (eventName, eventPayload = {}) => {
    if (!tenantId) return null

    try {
      return await recordOnboardingEvent(tenantId, eventName, eventPayload)
    } catch (nextError) {
      console.error('Error recording onboarding event:', nextError)
      return null
    }
  }

  const completeChecklistItem = (itemId, metadata = {}) => {
    const patched = patchState((current) => {
      const nextItems = {
        ...(current.checklistState?.items || {}),
        [itemId]: {
          completed: true,
          completedAt: new Date().toISOString(),
          metadata,
        },
      }
      return {
        checklistState: {
          ...(current.checklistState || {}),
          items: nextItems,
        },
      }
    })

    patched.then((nextState) => {
      if (nextState) emitEvent('checklist_item_completed', { itemId, ...metadata })
    }).catch(() => {})

    return patched
  }

  const dismissSurface = ({ scope, reason = 'manual_close' }) => {
    return patchState((current) => ({
      dismissState: {
        ...(current.dismissState || {}),
        [scope]: {
          dismissed: true,
          dismissed_at: new Date().toISOString(),
          dismiss_scope: scope,
          dismiss_reason: reason,
        },
      },
    }))
  }

  const markTutorialOpened = (tutorialId) => {
    const patched = patchState((current) => {
      const opened = Array.from(new Set([...(current.tutorialState?.opened || []), tutorialId]))
      return {
        tutorialState: {
          ...(current.tutorialState || {}),
          opened,
        },
      }
    })

    patched.then((nextState) => {
      if (nextState) emitEvent('tutorial_opened', { tutorialId })
    }).catch(() => {})

    return patched
  }

  const markTutorialCompleted = (tutorialId) => {
    const patched = patchState((current) => {
      const opened = Array.from(new Set([...(current.tutorialState?.opened || []), tutorialId]))
      const completed = Array.from(new Set([...(current.tutorialState?.completed || []), tutorialId]))
      return {
        tutorialState: {
          ...(current.tutorialState || {}),
          opened,
          completed,
        },
      }
    })

    patched.then((nextState) => {
      if (nextState) emitEvent('tutorial_completed', { tutorialId })
    }).catch(() => {})

    return patched
  }

  const updateTourState = (tourState, eventName = null) => {
    const patched = patchState(() => ({ tourState }))

    if (eventName) {
      patched.then((nextState) => {
        if (nextState) {
          emitEvent(eventName, { status: tourState?.status || null, lastStep: tourState?.last_step || null })
        }
      }).catch(() => {})
    }

    return patched
  }

  const checklist = ONBOARDING_CHECKLIST.map((item) => ({
    ...item,
    completed: Boolean(state.checklistState?.items?.[item.id]?.completed),
    completedAt: state.checklistState?.items?.[item.id]?.completedAt ?? null,
  }))

  const completedChecklistCount = checklist.filter((item) => item.completed).length

  return {
    loading,
    error,
    state,
    initializationMode,
    seedProfile,
    tutorials: TUTORIAL_CATALOG,
    quickActions: QUICK_ACTIONS,
    checklist,
    completedChecklistCount,
    totalChecklistCount: checklist.length,
    patchState,
    emitEvent,
    completeChecklistItem,
    dismissSurface,
    markTutorialOpened,
    markTutorialCompleted,
    updateTourState,
  }
}
