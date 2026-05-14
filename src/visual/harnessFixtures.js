const FIXTURE_USER = { id: 'visual-user-1', email: 'ops@nexuscrm.test' }
const FIXTURE_TENANT = {
  id: 'fixture-tenant-1',
  name: 'Atlas Bio (Demo)',
  slug: 'atlas-bio',
  role: 'owner',
  membershipStatus: 'active',
  ownerUserId: 'visual-user-1',
}

export const FIXTURE_AUTH_VALUE = {
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

export const FIXTURE_TENANT_VALUE = {
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
