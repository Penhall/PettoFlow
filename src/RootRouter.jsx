import { useEffect, useState } from 'react'
import App from './App.jsx'
import AdminRoute from './admin/AdminRoute.jsx'
import TenantGate from './components/tenant/TenantGate.jsx'
import { TenantProvider } from './context/TenantContext.jsx'
import { useTenant } from './hooks/useTenant.js'

function getCurrentRoute() {
  if (typeof window === 'undefined') return 'app'
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'app'
}

function TenantScopedApp() {
  const { activeTenantId } = useTenant()

  return (
    <div key={activeTenantId ?? 'tenant-pending'}>
      <App />
    </div>
  )
}

function TenantAppRoute() {
  return (
    <TenantProvider>
      <TenantGate>
        <TenantScopedApp />
      </TenantGate>
    </TenantProvider>
  )
}

export default function RootRouter() {
  const [route, setRoute] = useState(getCurrentRoute())

  useEffect(() => {
    const handleHashChange = () => setRoute(getCurrentRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route === 'admin') {
    return <AdminRoute />
  }

  return <TenantAppRoute />
}
