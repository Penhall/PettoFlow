import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import WorkspaceGate from './components/WorkspaceGate.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <WorkspaceGate>
        <App />
      </WorkspaceGate>
    </ThemeProvider>
  </React.StrictMode>,
)
