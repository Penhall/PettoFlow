import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
import { FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE } from './harnessFixtures.js'

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
