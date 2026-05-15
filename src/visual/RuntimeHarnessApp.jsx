import { Suspense, useEffect, useState } from 'react'
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import TenantGate from '../components/tenant/TenantGate.jsx'
import App from '../App.jsx'
import { AuthContext } from '../context/authContext.js'
import { RuntimeOrchestrationProvider } from '../context/RuntimeOrchestrationContext.jsx'
import { TenantContext } from '../context/tenantContext.js'
import { lazyWithRetry } from '../lib/lazyWithRetry.js'
import { FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE } from './harnessFixtures.js'

function readHarnessMode() {
  if (typeof window === 'undefined') return 'authenticated'
  return new URL(window.location.href).searchParams.get('harness-mode') || 'authenticated'
}

const UNAUTHENTICATED_FIXTURE = {
  ...FIXTURE_AUTH_VALUE,
  session: null,
  user: null,
  isAuthenticated: false,
}

const TENANT_LOADING_FIXTURE = {
  ...FIXTURE_TENANT_VALUE,
  loading: true,
  activeTenantId: null,
  activeTenant: null,
  hasTenant: false,
  tenants: [],
}

const TENANT_ERROR_FIXTURE = {
  ...FIXTURE_TENANT_VALUE,
  loading: false,
  activeTenantId: null,
  activeTenant: null,
  hasTenant: false,
  tenants: [],
  error: 'Erro simulado ao carregar espacos de trabalho.',
}

const LazyRejectSurface = lazyWithRetry(
  async () => {
    throw new Error('Harness lazy import rejection')
  },
  'runtime-harness-lazy-reject',
)

// Intentionally crashes on every render to test RootErrorBoundary behavior.
function CrashTestSurface() {
  throw new Error('Crash test: intentional render failure for boundary validation')
}

function AsyncRejectionSurface() {
  useEffect(() => {
    void Promise.reject(new Error('Harness async rejection'))
  }, [])

  return <div data-testid="async-rejection-surface">Async rejection harness armed.</div>
}

function AsyncEventSurface() {
  const [triggered, setTriggered] = useState(false)

  return (
    <div data-testid="async-event-surface">
      <button
        type="button"
        onClick={() => {
          setTriggered(true)
          window.setTimeout(() => {
            throw new Error('Harness async event failure')
          }, 0)
        }}
      >
        Trigger async event failure
      </button>
      {triggered ? <span>Triggered.</span> : null}
    </div>
  )
}

function LazyRejectHarness() {
  return (
    <Suspense fallback={<div data-testid="lazy-reject-fallback">Loading lazy reject harness...</div>}>
      <LazyRejectSurface />
    </Suspense>
  )
}

function AppTopologyShell({ authValue, tenantValue }) {
  return (
    <div data-testid="app-topology-harness">
      <AuthContext.Provider value={authValue}>
        <RuntimeOrchestrationProvider>
          <ProtectedRoute>
            <TenantContext.Provider value={tenantValue}>
              <TenantGate>
                <App />
              </TenantGate>
            </TenantContext.Provider>
          </ProtectedRoute>
        </RuntimeOrchestrationProvider>
      </AuthContext.Provider>
    </div>
  )
}

export default function RuntimeHarnessApp() {
  const mode = readHarnessMode()

  if (mode === 'crash') {
    return <CrashTestSurface />
  }

  if (mode === 'async-rejection') {
    return <AsyncRejectionSurface />
  }

  if (mode === 'async-event') {
    return <AsyncEventSurface />
  }

  if (mode === 'lazy-reject') {
    return <LazyRejectHarness />
  }

  if (mode === 'unauthenticated') {
    return (
      <AuthContext.Provider value={UNAUTHENTICATED_FIXTURE}>
        <RuntimeOrchestrationProvider>
          <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
            <ProtectedRoute>
              <div id="runtime-topology-root">
                Runtime topology: ProtectedRoute resolved to children.
              </div>
            </ProtectedRoute>
          </TenantContext.Provider>
        </RuntimeOrchestrationProvider>
      </AuthContext.Provider>
    )
  }

  if (mode === 'authenticated') {
    return (
      <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
        <RuntimeOrchestrationProvider>
          <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
            <ProtectedRoute>
              <div id="runtime-topology-root">
                Runtime topology: ProtectedRoute resolved to children.
              </div>
            </ProtectedRoute>
          </TenantContext.Provider>
        </RuntimeOrchestrationProvider>
      </AuthContext.Provider>
    )
  }

  if (mode === 'app-topology') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={FIXTURE_TENANT_VALUE}
      />
    )
  }

  if (mode === 'app-topology-unauthenticated') {
    return (
      <AppTopologyShell
        authValue={UNAUTHENTICATED_FIXTURE}
        tenantValue={FIXTURE_TENANT_VALUE}
      />
    )
  }

  if (mode === 'app-topology-tenant-loading') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={TENANT_LOADING_FIXTURE}
      />
    )
  }

  if (mode === 'app-topology-tenant-error') {
    return (
      <AppTopologyShell
        authValue={FIXTURE_AUTH_VALUE}
        tenantValue={TENANT_ERROR_FIXTURE}
      />
    )
  }

  return (
    <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
      <RuntimeOrchestrationProvider>
        <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
          <ProtectedRoute>
            <div id="runtime-topology-root">
              Runtime topology: ProtectedRoute resolved to children.
            </div>
          </ProtectedRoute>
        </TenantContext.Provider>
      </RuntimeOrchestrationProvider>
    </AuthContext.Provider>
  )
}
