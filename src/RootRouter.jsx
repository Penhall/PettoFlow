import { useEffect, useState } from 'react'
import App from './App.jsx'
import AdminRoute from './admin/AdminRoute.jsx'
import TenantGate from './components/tenant/TenantGate.jsx'
import { TenantProvider } from './context/TenantContext.jsx'
import { useRuntimeOrchestration } from './hooks/useRuntimeOrchestration.js'

function getCurrentRoute() {
  if (typeof window === 'undefined') return 'app'
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'app'
}

function TenantAppRoute() {
  return (
    <TenantProvider>
      <TenantGate>
        <App />
      </TenantGate>
    </TenantProvider>
  )
}

export default function RootRouter() {
  const [route, setRoute] = useState(getCurrentRoute())
  const { syncRoute } = useRuntimeOrchestration()

  useEffect(() => {
    const handleHashChange = () => setRoute(getCurrentRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    syncRoute(route)
  }, [route, syncRoute])

  if (route === 'admin') {
    return <AdminRoute />
  }

  return <TenantAppRoute />
}
