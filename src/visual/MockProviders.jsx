import { AuthContext } from '../context/authContext.js'
import { TenantContext } from '../context/tenantContext.js'
import { FIXTURE_AUTH_VALUE, FIXTURE_TENANT_VALUE } from './harnessFixtures.js'

export function MockAuthProvider({ children, overrides = {} }) {
  return (
    <AuthContext.Provider value={{ ...FIXTURE_AUTH_VALUE, ...overrides }}>
      {children}
    </AuthContext.Provider>
  )
}

export function MockTenantProvider({ children, overrides = {} }) {
  return (
    <TenantContext.Provider value={{ ...FIXTURE_TENANT_VALUE, ...overrides }}>
      {children}
    </TenantContext.Provider>
  )
}
