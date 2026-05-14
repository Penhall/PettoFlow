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
  const stateRef = useRef(state)
  const [loading, setLoading] = useState(Boolean(enabled && tenantId))
  const [error, setError] = useState(null)
  const [initializationMode, setInitializationMode] = useState('guided_seeded')
  const [seedProfile, setSeedProfile] = useState(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!enabled || !tenantId) {
      setState(buildFallbackState())
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
        setState(normalizeResponseState(data?.state))
        setInitializationMode(data?.initializationMode || 'guided_seeded')
        setSeedProfile(data?.seedProfile || null)
      })
      .catch((nextError) => {
        if (cancelled) return
        console.error('Error fetching onboarding state:', nextError)
        setError(nextError)
        setState(buildFallbackState())
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

  const patchState = async (payload) => {
    if (!tenantId) return null

    try {
      const data = await updateOnboardingState(tenantId, payload)
      const nextState = normalizeResponseState(data?.state)
      setState(nextState)
      return nextState
    } catch (nextError) {
      console.error('Error updating onboarding state:', nextError)
      setError(nextError)
      return null
    }
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

  const completeChecklistItem = async (itemId, metadata = {}) => {
    // Read stateRef.current so rapid successive calls each see the latest
    // server-confirmed state rather than a stale closure snapshot.
    const current = stateRef.current
    const nextItems = {
      ...(current.checklistState?.items || {}),
      [itemId]: {
        completed: true,
        completedAt: new Date().toISOString(),
        metadata,
      },
    }

    const nextChecklistState = {
      ...(current.checklistState || {}),
      items: nextItems,
    }

    const nextState = await patchState({ checklistState: nextChecklistState })
    await emitEvent('checklist_item_completed', { itemId, ...metadata })
    return nextState
  }

  const dismissSurface = async ({ scope, reason = 'manual_close' }) => {
    const current = stateRef.current
    const nextDismissState = {
      ...(current.dismissState || {}),
      [scope]: {
        dismissed: true,
        dismissed_at: new Date().toISOString(),
        dismiss_scope: scope,
        dismiss_reason: reason,
      },
    }

    return patchState({ dismissState: nextDismissState })
  }

  const markTutorialOpened = async (tutorialId) => {
    const current = stateRef.current
    const opened = Array.from(new Set([...(current.tutorialState?.opened || []), tutorialId]))
    const nextTutorialState = {
      ...(current.tutorialState || {}),
      opened,
    }

    const nextState = await patchState({ tutorialState: nextTutorialState })
    await emitEvent('tutorial_opened', { tutorialId })
    return nextState
  }

  const markTutorialCompleted = async (tutorialId) => {
    const current = stateRef.current
    const opened = Array.from(new Set([...(current.tutorialState?.opened || []), tutorialId]))
    const completed = Array.from(new Set([...(current.tutorialState?.completed || []), tutorialId]))
    const nextTutorialState = {
      ...(current.tutorialState || {}),
      opened,
      completed,
    }

    const nextState = await patchState({ tutorialState: nextTutorialState })
    await emitEvent('tutorial_completed', { tutorialId })
    return nextState
  }

  const updateTourState = async (tourState, eventName = null) => {
    const nextState = await patchState({ tourState })
    if (eventName) {
      await emitEvent(eventName, { status: tourState?.status || null, lastStep: tourState?.last_step || null })
    }
    return nextState
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
