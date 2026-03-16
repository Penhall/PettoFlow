import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Try to get saved theme, otherwise default to "ledger"
    const savedTheme = localStorage.getItem('pettoflow_theme');
    return savedTheme || 'ledger';
  });

  useEffect(() => {
    // Apply theme to the HTML element
    document.documentElement.setAttribute('data-theme', theme);
    // Save to local storage
    localStorage.setItem('pettoflow_theme', theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
    themes: [
      { id: 'ledger', name: 'Livro-Razão (Ledger)' },
      { id: 'classic', name: 'Clássico SaaS' },
      { id: 'dark', name: 'Modo Noturno' },
      { id: 'twenty', name: 'Twenty (Grafite)' },
    ]
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
