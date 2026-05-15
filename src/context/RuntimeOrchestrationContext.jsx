import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { RuntimeOrchestrationContext } from './runtimeOrchestrationContext.js'
import {
  createInitialRuntimeOrchestrationState,
  reduceRuntimeOrchestrationState,
} from '../lib/runtimeOrchestration.js'
import {
  traceCancellation,
  traceOrchestrationTransition,
  traceRetryLifecycle,
  traceTransitionConflict,
} from '../lib/diagnostics.js'

function setRuntimeGlobals(state) {
  if (typeof window === 'undefined') return
  window.__NEXUS_RUNTIME_PHASE__ = state.phase
  window.__NEXUS_RUNTIME_STATE__ = {
    phase: state.phase,
    route: state.route,
    auth: state.auth,
    tenant: state.tenant,
    workspace: state.workspace,
    recovering: state.recovering,
    lastError: state.lastError,
  }

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.nexusRuntimePhase = state.phase
  }
}

export function RuntimeOrchestrationProvider({ children }) {
  const { loading, isAuthenticated, isConfigured } = useAuth()
  const [state, dispatch] = useReducer(
    reduceRuntimeOrchestrationState,
    undefined,
    createInitialRuntimeOrchestrationState,
  )
  const stateRef = useRef(state)
  const previousPhaseRef = useRef(null)
  const tenantRequestRef = useRef(0)
  const workspaceRequestRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
    setRuntimeGlobals(state)
  }, [state])

  useEffect(() => {
    dispatch({
      type: 'AUTH_SYNC',
      payload: {
        loading,
        isAuthenticated,
        isConfigured,
      },
    })
  }, [loading, isAuthenticated, isConfigured])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current
    if (previousPhase !== state.phase) {
      traceOrchestrationTransition(previousPhase, state.phase, 'state-sync', {
        route: state.route,
        tenantId: state.tenant.activeTenantId,
      })
      previousPhaseRef.current = state.phase
    }
  }, [state.phase, state.route, state.tenant.activeTenantId])

  const api = useMemo(() => ({
    syncRoute(route) {
      dispatch({
        type: 'ROUTE_SYNC',
        payload: { route },
      })
    },
    startTenantLoad(reason, detail = null) {
      const requestId = tenantRequestRef.current + 1
      tenantRequestRef.current = requestId
      dispatch({
        type: 'TENANT_LOAD_START',
        payload: {
          requestId,
          reason,
          detail,
        },
      })
      return requestId
    },
    resolveTenantLoad(requestId, payload) {
      dispatch({
        type: 'TENANT_LOAD_RESOLVE',
        payload: {
          requestId,
          ...payload,
        },
      })
    },
    failTenantLoad(requestId, error, detail = null) {
      dispatch({
        type: 'TENANT_LOAD_ERROR',
        payload: {
          requestId,
          error: error?.message ?? String(error),
          detail,
        },
      })
    },
    cancelTenantLoad(requestId, detail = null) {
      traceCancellation('tenant-load', {
        requestId,
        detail,
      })
      dispatch({
        type: 'TENANT_LOAD_CANCEL',
        payload: {
          requestId,
          detail,
        },
      })
    },
    setActiveTenant(activeTenantId, detail = null) {
      dispatch({
        type: 'TENANT_SET_ACTIVE',
        payload: {
          activeTenantId,
          hasTenant: detail?.hasTenant ?? stateRef.current.tenant.hasTenant,
          detail,
        },
      })
    },
    startWorkspaceLoad(tenantId, reason, detail = null) {
      const requestId = workspaceRequestRef.current + 1
      workspaceRequestRef.current = requestId
      dispatch({
        type: 'WORKSPACE_LOAD_START',
        payload: {
          requestId,
          tenantId,
          reason,
          detail,
        },
      })
      return requestId
    },
    resolveWorkspaceLoad(requestId, tenantId, detail = null) {
      dispatch({
        type: 'WORKSPACE_LOAD_RESOLVE',
        payload: {
          requestId,
          tenantId,
          detail,
        },
      })
    },
    failWorkspaceLoad(requestId, tenantId, error, detail = null) {
      dispatch({
        type: 'WORKSPACE_LOAD_ERROR',
        payload: {
          requestId,
          tenantId,
          error: error?.message ?? String(error),
          detail,
        },
      })
    },
    cancelWorkspaceLoad(requestId, tenantId, detail = null) {
      traceCancellation('workspace-load', {
        requestId,
        tenantId,
        detail,
      })
      dispatch({
        type: 'WORKSPACE_LOAD_CANCEL',
        payload: {
          requestId,
          tenantId,
          detail,
        },
      })
    },
    startRetry(scope, detail = null) {
      traceRetryLifecycle(scope, 'start', detail)
      dispatch({
        type: 'BOOTSTRAP_RETRY',
        payload: {
          scope,
          tenantId: detail?.tenantId ?? stateRef.current.tenant.activeTenantId,
          reason: detail?.reason ?? null,
        },
      })
    },
    completeRetry(scope, detail = null) {
      traceRetryLifecycle(scope, 'complete', detail)
    },
    startTransition(kind, payload) {
      const active = stateRef.current.activeTransitions[kind]
      if (active) {
        traceTransitionConflict(kind, active, payload)
      }
      dispatch({
        type: 'TRANSITION_START',
        payload: {
          kind,
          ...payload,
        },
      })
    },
    completeTransition(kind, payload = null) {
      dispatch({
        type: 'TRANSITION_COMPLETE',
        payload: {
          kind,
          detail: payload,
        },
      })
    },
    interruptTransition(kind, payload = null) {
      traceCancellation(`transition:${kind}`, payload)
      dispatch({
        type: 'TRANSITION_INTERRUPT',
        payload: {
          kind,
          detail: payload,
        },
      })
    },
  }), [])

  const value = useMemo(() => ({
    ...api,
    phase: state.phase,
    state,
  }), [api, state])

  return (
    <RuntimeOrchestrationContext.Provider value={value}>
      {children}
    </RuntimeOrchestrationContext.Provider>
  )
}
