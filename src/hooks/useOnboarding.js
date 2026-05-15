import { useEffect, useRef, useState } from 'react'
import {
  traceAsyncFailure,
  countOnboardingCompleted,
  countOnboardingDropOff,
  countOnboardingRetry,
  countOverlayInterruption,
} from '../lib/diagnostics.js'
import { useRuntimeOrchestration } from './useRuntimeOrchestration.js'
import { getOnboardingState, recordOnboardingEvent, updateOnboardingState } from '../lib/onboardingApi.js'
import { CURRENT_ONBOARDING_VERSION } from '../lib/onboardingState.js'
import { ONBOARDING_CHECKLIST, QUICK_ACTIONS, TUTORIAL_CATALOG } from '../lib/tutorialCatalog.js'
import { readSuccess, runReadWithRetry } from '../lib/readResult.js'

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
  const [readResult, setReadResult] = useState(() => readSuccess(buildFallbackState()))
  const [initializationMode, setInitializationMode] = useState('guided_seeded')
  const [seedProfile, setSeedProfile] = useState(null)

  // Orchestration integration
  const { startTransition: startOrchTransition, completeTransition: completeOrchTransition } =
    useRuntimeOrchestration()

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
      setReadResult(readSuccess(fallback))
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    runReadWithRetry('onboarding.load', () => getOnboardingState(tenantId), {
      previousData: committedStateRef.current,
      signal: controller.signal,
      tenantId,
      retries: 0,
      onState: setReadResult,
    })
      .then((result) => {
        if (controller.signal.aborted) return
        if (!result.ok) {
          const loadError = new Error(result.error?.message || 'Não foi possível carregar o onboarding.')
          loadError.code = result.error?.code
          loadError.diagnostics = result.error?.diagnostics
          setError(loadError)
          traceAsyncFailure('onboarding-failure', new Error(result.error?.diagnostics?.rawMessage || result.error?.message), { stage: 'load', tenantId })
          countOnboardingRetry()
          return
        }
        const data = result.data
        const nextState = normalizeResponseState(data?.state)
        setState(nextState)
        committedStateRef.current = nextState
        setInitializationMode(data?.initializationMode || 'guided_seeded')
        setSeedProfile(data?.seedProfile || null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
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
        traceAsyncFailure('onboarding-failure', nextError, { stage: 'patch', tenantId })
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
      traceAsyncFailure('onboarding-failure', nextError, { stage: 'event', tenantId, eventName })
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
      if (nextState) {
        emitEvent('checklist_item_completed', { itemId, ...metadata })
        // Count completed — if all items done, count as full onboarding completion
        const totalItems = ONBOARDING_CHECKLIST.length
        const completedItems = Object.values(nextState.checklistState?.items || {}).filter(
          (item) => item.completed
        ).length
        if (completedItems >= totalItems) {
          countOnboardingCompleted()
        }
      }
    }).catch(() => {})

    return patched
  }

  const dismissSurface = ({ scope, reason = 'manual_close' }) => {
    startOrchTransition('ui-overlay', {
      from: scope,
      to: 'dismissed',
      detail: { reason, source: 'onboarding' },
    })
    countOverlayInterruption()

    // Track drop-off if onboarding panel is dismissed with pending items
    const checkItems = ONBOARDING_CHECKLIST.map((item) => ({
      completed: Boolean(state.checklistState?.items?.[item.id]?.completed),
    }))
    const hasPendingItems = checkItems.some((item) => !item.completed)
    if (hasPendingItems) {
      countOnboardingDropOff()
    }

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
    })).then((result) => {
      if (result) {
        completeOrchTransition('ui-overlay', { scope, reason })
      }
      return result
    })
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
    readResult,
    readState: readResult.state,
    stale: readResult.stale,
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
