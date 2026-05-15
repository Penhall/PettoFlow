import { describe, expect, it } from 'vitest'
import {
  RUNTIME_PHASES,
  createInitialRuntimeOrchestrationState,
  deriveRuntimePhase,
  reduceRuntimeOrchestrationState,
} from './runtimeOrchestration.js'

describe('runtimeOrchestration', () => {
  it('derives AUTH_HYDRATING while auth has not resolved', () => {
    const state = createInitialRuntimeOrchestrationState()

    expect(deriveRuntimePhase(state)).toBe(RUNTIME_PHASES.AUTH_HYDRATING)
  })

  it('derives TENANT_LOADING after auth resolves and tenant loading starts', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'AUTH_SYNC',
      payload: {
        loading: false,
        isAuthenticated: true,
        isConfigured: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TENANT_LOAD_START',
      payload: {
        requestId: 1,
        reason: 'initial-authenticated-load',
      },
    })

    expect(state.phase).toBe(RUNTIME_PHASES.TENANT_LOADING)
  })

  it('derives WORKSPACE_LOADING when tenant is active and workspace bootstrap begins', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'AUTH_SYNC',
      payload: {
        loading: false,
        isAuthenticated: true,
        isConfigured: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TENANT_LOAD_RESOLVE',
      payload: {
        requestId: 1,
        activeTenantId: 'tenant-1',
        hasTenant: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'WORKSPACE_LOAD_START',
      payload: {
        requestId: 1,
        tenantId: 'tenant-1',
        reason: 'initial-bootstrap',
      },
    })

    expect(state.phase).toBe(RUNTIME_PHASES.WORKSPACE_LOADING)
  })

  it('derives APP_READY after workspace bootstrap resolves', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'AUTH_SYNC',
      payload: {
        loading: false,
        isAuthenticated: true,
        isConfigured: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TENANT_LOAD_RESOLVE',
      payload: {
        requestId: 1,
        activeTenantId: 'tenant-1',
        hasTenant: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'WORKSPACE_LOAD_START',
      payload: {
        requestId: 1,
        tenantId: 'tenant-1',
        reason: 'initial-bootstrap',
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'WORKSPACE_LOAD_RESOLVE',
      payload: {
        requestId: 1,
        tenantId: 'tenant-1',
      },
    })

    expect(state.phase).toBe(RUNTIME_PHASES.APP_READY)
  })

  it('derives BOOTSTRAP_ERROR after tenant bootstrap failure', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'AUTH_SYNC',
      payload: {
        loading: false,
        isAuthenticated: true,
        isConfigured: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TENANT_LOAD_ERROR',
      payload: {
        requestId: 1,
        error: 'boom',
      },
    })

    expect(state.phase).toBe(RUNTIME_PHASES.BOOTSTRAP_ERROR)
  })

  it('derives RECOVERING while an explicit retry is in-flight', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'AUTH_SYNC',
      payload: {
        loading: false,
        isAuthenticated: true,
        isConfigured: true,
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'BOOTSTRAP_RETRY',
      payload: {
        scope: 'workspace',
        tenantId: 'tenant-1',
        reason: 'user-retry',
      },
    })

    expect(state.phase).toBe(RUNTIME_PHASES.RECOVERING)
  })

  it('tracks transition conflicts when overlapping transitions start', () => {
    let state = createInitialRuntimeOrchestrationState()
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TRANSITION_START',
      payload: {
        kind: 'route',
        from: 'tarefas',
        to: 'financas',
      },
    })
    state = reduceRuntimeOrchestrationState(state, {
      type: 'TRANSITION_START',
      payload: {
        kind: 'route',
        from: 'financas',
        to: 'clientes',
      },
    })

    expect(state.transitionConflicts).toHaveLength(1)
    expect(state.transitionConflicts[0]).toMatchObject({
      kind: 'route',
      conflictWith: {
        from: 'tarefas',
        to: 'financas',
      },
    })
  })
})
