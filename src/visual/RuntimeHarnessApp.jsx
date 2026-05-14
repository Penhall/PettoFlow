import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
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

// Intentionally crashes on every render to test RootErrorBoundary behavior.
function CrashTestSurface() {
  throw new Error('Crash test: intentional render failure for boundary validation')
}

export default function RuntimeHarnessApp() {
  const mode = readHarnessMode()

  if (mode === 'crash') {
    return <CrashTestSurface />
  }

  const authValue = mode === 'unauthenticated' ? UNAUTHENTICATED_FIXTURE : FIXTURE_AUTH_VALUE

  return (
    <AuthContext.Provider value={authValue}>
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
