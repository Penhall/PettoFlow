import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import RootRouter from './RootRouter.jsx'
import DeferredSurface from './components/shared/DeferredSurface.jsx'

const VisualRegressionApp = lazy(() => import('./visual/VisualRegressionApp.jsx'))

function isVisualRegressionEntry() {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  return url.searchParams.get('visual-regression') === '1'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      {isVisualRegressionEntry() ? (
        <Suspense fallback={<DeferredSurface label="Carregando harness visual..." />}>
          <VisualRegressionApp />
        </Suspense>
      ) : (
        <AuthProvider>
          <ProtectedRoute>
            <RootRouter />
          </ProtectedRoute>
        </AuthProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>,
)
