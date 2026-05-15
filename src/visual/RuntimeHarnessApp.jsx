import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import TenantGate from '../components/tenant/TenantGate.jsx'
import App from '../App.jsx'
import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
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
  error: 'Erro simulado ao carregar espaços de trabalho.',
}

// Intentionally crashes on every render to test RootErrorBoundary behavior.
function CrashTestSurface() {
  throw new Error('Crash test: intentional render failure for boundary validation')
}

function AppTopologyShell({ authValue, tenantValue }) {
  return (
    <div data-testid="app-topology-harness">
      <AuthContext.Provider value={authValue}>
        <ProtectedRoute>
          <TenantContext.Provider value={tenantValue}>
            <TenantGate>
              <div key={tenantValue.activeTenantId ?? 'no-tenant'}>
                <App />
              </div>
            </TenantGate>
          </TenantContext.Provider>
        </ProtectedRoute>
      </AuthContext.Provider>
    </div>
  )
}

export default function RuntimeHarnessApp() {
  const mode = readHarnessMode()

  if (mode === 'crash') {
    return <CrashTestSurface />
  }

  // ── Legacy fixture modes (ProtectedRoute only, no full app) ──────────────────
  if (mode === 'unauthenticated') {
    return (
      <AuthContext.Provider value={UNAUTHENTICATED_FIXTURE}>
        <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
          <ProtectedRoute>
            <div id="runtime-topology-root">
              Runtime topology: ProtectedRoute resolved to children.
            </div>
          </ProtectedRoute>
        </TenantContext.Provider>
      </AuthContext.Provider>
    )
  }

  if (mode === 'authenticated') {
    return (
      <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
        <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
          <ProtectedRoute>
            <div id="runtime-topology-root">
              Runtime topology: ProtectedRoute resolved to children.
            </div>
          </ProtectedRoute>
        </TenantContext.Provider>
      </AuthContext.Provider>
    )
  }

  // ── Phase 28: real app-topology modes ────────────────────────────────────────
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

  // fallback: default authenticated fixture (legacy behaviour)
  return (
    <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
      <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
        <ProtectedRoute>
          <div id="runtime-topology-root">
            Runtime topology: ProtectedRoute resolved to children.
          </div>
        </ProtectedRoute>
      </TenantContext.Provider>
    </AuthContext.Provider>
  )
}
