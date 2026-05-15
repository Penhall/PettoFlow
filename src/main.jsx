import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { RuntimeOrchestrationProvider } from './context/RuntimeOrchestrationContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import RootRouter from './RootRouter.jsx'
import DeferredSurface from './components/shared/DeferredSurface.jsx'
import RootErrorBoundary from './components/shared/RootErrorBoundary.jsx'

const VisualRegressionApp = import.meta.env.DEV
  ? lazy(() => import('./visual/VisualRegressionApp.jsx'))
  : null
const VisualHarnessProviders = import.meta.env.DEV
  ? lazy(() => import('./visual/VisualHarnessProviders.jsx').then((module) => ({ default: module.VisualHarnessProviders })))
  : null
const RuntimeHarnessApp = import.meta.env.DEV
  ? lazy(() => import('./visual/RuntimeHarnessApp.jsx'))
  : null

function isVisualRegressionEntry() {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  return url.searchParams.get('visual-regression') === '1'
}

function isRuntimeHarnessEntry() {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false
  return new URL(window.location.href).searchParams.get('runtime-harness') === '1'
}

if (import.meta.env.DEV && typeof window !== 'undefined' && window.__NEXUS_STRICT_OWNERSHIP__ === undefined) {
  window.__NEXUS_STRICT_OWNERSHIP__ = true
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <RootErrorBoundary>
        {isRuntimeHarnessEntry() ? (
          <Suspense fallback={<DeferredSurface label="Carregando harness de runtime..." />}>
            <RuntimeHarnessApp />
          </Suspense>
        ) : isVisualRegressionEntry() ? (
          <Suspense fallback={<DeferredSurface label="Carregando harness visual..." />}>
            {VisualHarnessProviders && VisualRegressionApp ? (
              <VisualHarnessProviders>
                <VisualRegressionApp />
              </VisualHarnessProviders>
            ) : null}
          </Suspense>
        ) : (
          <AuthProvider>
            <RuntimeOrchestrationProvider>
              <ProtectedRoute>
                <RootRouter />
              </ProtectedRoute>
            </RuntimeOrchestrationProvider>
          </AuthProvider>
        )}
      </RootErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
)
