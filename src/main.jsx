import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { TenantProvider } from './context/TenantContext.jsx'
import TenantGate from './components/tenant/TenantGate.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ProtectedRoute>
          <TenantProvider>
            <TenantGate>
              <App />
            </TenantGate>
          </TenantProvider>
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
