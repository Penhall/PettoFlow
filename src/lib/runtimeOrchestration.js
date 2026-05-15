import { countStaleRequestInterruption } from './diagnostics.js'

export const RUNTIME_PHASES = {
  BOOTSTRAP_IDLE: 'BOOTSTRAP_IDLE',
  AUTH_HYDRATING: 'AUTH_HYDRATING',
  AUTHENTICATED: 'AUTHENTICATED',
  TENANT_LOADING: 'TENANT_LOADING',
  WORKSPACE_LOADING: 'WORKSPACE_LOADING',
  APP_READY: 'APP_READY',
  BOOTSTRAP_ERROR: 'BOOTSTRAP_ERROR',
  RECOVERING: 'RECOVERING',
}

function createEmptyTransitionMap() {
  return {
    route: null,
    tenant: null,
    auth: null,
    bootstrap: null,
  }
}

function resetWorkspaceState() {
  return {
    loading: false,
    ready: false,
    requestId: 0,
    tenantId: null,
    reason: null,
    error: null,
  }
}

function resetTenantState() {
  return {
    synced: false,
    loading: false,
    requestId: 0,
    reason: null,
    error: null,
    hasTenant: false,
    activeTenantId: null,
  }
}

export function createInitialRuntimeOrchestrationState() {
  const state = {
    phase: RUNTIME_PHASES.BOOTSTRAP_IDLE,
    route: 'app',
    auth: {
      loading: true,
      resolved: false,
      isAuthenticated: false,
      isConfigured: true,
    },
    tenant: resetTenantState(),
    workspace: resetWorkspaceState(),
    recovering: null,
    lastError: null,
    activeTransitions: createEmptyTransitionMap(),
    transitionConflicts: [],
  }

  return {
    ...state,
    phase: deriveRuntimePhase(state),
  }
}

export function deriveRuntimePhase(state) {
  if (state.recovering) {
    // Se recovering scope não bate com o erro ativo, o BOOTSTRAP_ERROR
    // deve prevalecer para evitar deadlock visual.
    if (state.lastError && state.lastError.scope !== state.recovering.scope) {
      return RUNTIME_PHASES.BOOTSTRAP_ERROR
    }
    return RUNTIME_PHASES.RECOVERING
  }

  if (state.lastError || state.tenant.error || state.workspace.error) {
    return RUNTIME_PHASES.BOOTSTRAP_ERROR
  }

  if (state.auth.loading && !state.auth.resolved) {
    return RUNTIME_PHASES.AUTH_HYDRATING
  }

  if (!state.auth.isConfigured || !state.auth.isAuthenticated) {
    return RUNTIME_PHASES.BOOTSTRAP_IDLE
  }

  if (state.tenant.loading) {
    return RUNTIME_PHASES.TENANT_LOADING
  }

  if (!state.tenant.synced) {
    return RUNTIME_PHASES.AUTHENTICATED
  }

  if (state.workspace.loading) {
    return RUNTIME_PHASES.WORKSPACE_LOADING
  }

  if (state.tenant.activeTenantId && !state.workspace.ready) {
    return RUNTIME_PHASES.AUTHENTICATED
  }

  return RUNTIME_PHASES.APP_READY
}

function withDerivedPhase(state) {
  return {
    ...state,
    phase: deriveRuntimePhase(state),
  }
}

function appendConflict(state, kind, active, next) {
  return {
    ...state,
    transitionConflicts: [
      ...state.transitionConflicts,
      {
        kind,
        conflictWith: active,
        next,
      },
    ].slice(-25),
  }
}

export function reduceRuntimeOrchestrationState(state, action) {
  switch (action.type) {
    case 'AUTH_SYNC': {
      const nextAuth = {
        loading: Boolean(action.payload.loading),
        resolved: !action.payload.loading,
        isAuthenticated: Boolean(action.payload.isAuthenticated),
        isConfigured: action.payload.isConfigured !== false,
      }

      if (!nextAuth.isAuthenticated || !nextAuth.isConfigured) {
        return withDerivedPhase({
          ...state,
          auth: nextAuth,
          tenant: resetTenantState(),
          workspace: resetWorkspaceState(),
          recovering: null,
          lastError: null,
          activeTransitions: {
            ...createEmptyTransitionMap(),
            route: state.activeTransitions.route,
          },
        })
      }

      return withDerivedPhase({
        ...state,
        auth: nextAuth,
      })
    }

    case 'ROUTE_SYNC':
      return withDerivedPhase({
        ...state,
        route: action.payload.route ?? state.route,
      })

    case 'TENANT_LOAD_START':
      return withDerivedPhase({
        ...state,
        tenant: {
          ...state.tenant,
          synced: false,
          loading: true,
          requestId: action.payload.requestId,
          reason: action.payload.reason ?? null,
          error: null,
        },
        recovering: state.recovering?.scope === 'tenant' ? null : state.recovering,
        lastError: state.lastError?.scope === 'tenant' ? null : state.lastError,
      })

    case 'TENANT_LOAD_RESOLVE': {
      if (action.payload.requestId < state.tenant.requestId) {
        countStaleRequestInterruption()
        return state
      }

      return withDerivedPhase({
        ...state,
        tenant: {
          ...state.tenant,
          synced: true,
          loading: false,
          requestId: action.payload.requestId,
          error: null,
          hasTenant: Boolean(action.payload.hasTenant),
          activeTenantId: action.payload.activeTenantId ?? null,
        },
        workspace:
          action.payload.activeTenantId && action.payload.activeTenantId !== state.workspace.tenantId
            ? resetWorkspaceState()
            : state.workspace,
        recovering: state.recovering?.scope === 'tenant' ? null : state.recovering,
        lastError: state.lastError?.scope === 'tenant' ? null : state.lastError,
      })
    }

    case 'TENANT_LOAD_ERROR': {
      if (action.payload.requestId < state.tenant.requestId) {
        countStaleRequestInterruption()
        return state
      }

      return withDerivedPhase({
        ...state,
        tenant: {
          ...state.tenant,
          synced: true,
          loading: false,
          requestId: action.payload.requestId,
          error: action.payload.error,
        },
        recovering: state.recovering?.scope === 'tenant' ? null : state.recovering,
        lastError: {
          scope: 'tenant',
          message: action.payload.error,
          detail: action.payload.detail ?? null,
        },
      })
    }

    case 'TENANT_LOAD_CANCEL': {
      if (action.payload.requestId < state.tenant.requestId) {
        return state
      }

      return withDerivedPhase({
        ...state,
        tenant: {
          ...state.tenant,
          loading: false,
        },
      })
    }

    case 'TENANT_SET_ACTIVE':
      return withDerivedPhase({
        ...state,
        tenant: {
          ...state.tenant,
          synced: true,
          hasTenant: action.payload.hasTenant ?? state.tenant.hasTenant,
          activeTenantId: action.payload.activeTenantId ?? null,
          error: null,
        },
        workspace: resetWorkspaceState(),
        lastError: state.lastError?.scope === 'workspace' ? null : state.lastError,
      })

    case 'WORKSPACE_LOAD_START':
      return withDerivedPhase({
        ...state,
        workspace: {
          loading: true,
          ready: false,
          requestId: action.payload.requestId,
          tenantId: action.payload.tenantId ?? null,
          reason: action.payload.reason ?? null,
          error: null,
        },
        recovering: state.recovering?.scope === 'workspace' ? null : state.recovering,
        lastError: state.lastError?.scope === 'workspace' ? null : state.lastError,
      })

    case 'WORKSPACE_LOAD_RESOLVE': {
      if (action.payload.requestId < state.workspace.requestId) {
        countStaleRequestInterruption()
        return state
      }

      return withDerivedPhase({
        ...state,
        workspace: {
          ...state.workspace,
          loading: false,
          ready: true,
          requestId: action.payload.requestId,
          tenantId: action.payload.tenantId ?? state.workspace.tenantId,
          error: null,
        },
        recovering: state.recovering?.scope === 'workspace' ? null : state.recovering,
        lastError: state.lastError?.scope === 'workspace' ? null : state.lastError,
      })
    }

    case 'WORKSPACE_LOAD_ERROR': {
      if (action.payload.requestId < state.workspace.requestId) {
        countStaleRequestInterruption()
        return state
      }

      return withDerivedPhase({
        ...state,
        workspace: {
          ...state.workspace,
          loading: false,
          ready: false,
          requestId: action.payload.requestId,
          tenantId: action.payload.tenantId ?? state.workspace.tenantId,
          error: action.payload.error,
        },
        recovering: state.recovering?.scope === 'workspace' ? null : state.recovering,
        lastError: {
          scope: 'workspace',
          message: action.payload.error,
          detail: action.payload.detail ?? null,
        },
      })
    }

    case 'WORKSPACE_LOAD_CANCEL': {
      if (action.payload.requestId < state.workspace.requestId) {
        return state
      }

      return withDerivedPhase({
        ...state,
        workspace: {
          ...state.workspace,
          loading: false,
        },
      })
    }

    case 'BOOTSTRAP_RETRY':
      return withDerivedPhase({
        ...state,
        recovering: {
          scope: action.payload.scope,
          tenantId: action.payload.tenantId ?? null,
          reason: action.payload.reason ?? null,
        },
        lastError: null,
      })

    case 'TRANSITION_START': {
      const currentTransition = state.activeTransitions[action.payload.kind] ?? null
      let nextState = state
      if (currentTransition) {
        nextState = appendConflict(state, action.payload.kind, currentTransition, {
          from: action.payload.from ?? null,
          to: action.payload.to ?? null,
        })
      }

      return withDerivedPhase({
        ...nextState,
        activeTransitions: {
          ...nextState.activeTransitions,
          [action.payload.kind]: {
            from: action.payload.from ?? null,
            to: action.payload.to ?? null,
            detail: action.payload.detail ?? null,
          },
        },
      })
    }

    case 'TRANSITION_COMPLETE':
    case 'TRANSITION_INTERRUPT':
      return withDerivedPhase({
        ...state,
        activeTransitions: {
          ...state.activeTransitions,
          [action.payload.kind]: null,
        },
      })

    default:
      return state
  }
}
