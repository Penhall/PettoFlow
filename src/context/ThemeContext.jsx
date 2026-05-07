/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()
const PRODUCT_THEMES = [
  { id: 'light', name: 'Claro Premium' },
  { id: 'dark', name: 'Noturno Premium' },
  { id: 'classic', name: 'Clássico SaaS' },
  { id: 'twenty', name: 'Twenty (Grafite)' },
]

function resolveTheme(theme) {
  return PRODUCT_THEMES.some((item) => item.id === theme) ? theme : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem('pettoflow_theme')
    return resolveTheme(savedTheme)
  })

  const setTheme = (nextTheme) => {
    setThemeState((currentTheme) => {
      const resolvedTheme =
        typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme

      return resolveTheme(resolvedTheme)
    })
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pettoflow_theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: PRODUCT_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
