import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'

const FIXTURE_USER = { id: 'visual-user-1', email: 'ops@nexuscrm.test' }
const FIXTURE_TENANT = {
  id: 'fixture-tenant-1',
  name: 'Atlas Bio (Demo)',
  slug: 'atlas-bio',
  role: 'owner',
  membershipStatus: 'active',
  ownerUserId: 'visual-user-1',
}

const FIXTURE_AUTH_VALUE = {
  session: { user: FIXTURE_USER },
  user: FIXTURE_USER,
  loading: false,
  isAuthenticated: true,
  isPlatformAdmin: false,
  isConfigured: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshSession: async () => null,
}

const FIXTURE_TENANT_VALUE = {
  tenants: [FIXTURE_TENANT],
  activeTenant: FIXTURE_TENANT,
  activeTenantId: FIXTURE_TENANT.id,
  loading: false,
  error: null,
  hasTenant: true,
  refreshTenants: async () => [FIXTURE_TENANT],
  createWorkspace: async () => {},
  setActiveTenant: () => {},
}

// Provides fixture AuthContext + TenantContext values to the visual regression
// harness so shell components (SidebarRail, etc.) that call useAuth/useTenant
// don't throw "must be inside provider" errors.
export function VisualHarnessProviders({ children }) {
  return (
    <AuthContext.Provider value={FIXTURE_AUTH_VALUE}>
      <TenantContext.Provider value={FIXTURE_TENANT_VALUE}>
        {children}
      </TenantContext.Provider>
    </AuthContext.Provider>
  )
}
