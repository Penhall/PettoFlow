import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ThemeProvider, useTheme } from './ThemeContext.jsx'

function Probe() {
  const { theme, themes } = useTheme()

  return (
    <>
      <span>{theme}</span>
      <span>{themes.map((item) => item.id).join(',')}</span>
    </>
  )
}

test('ThemeProvider falls back to light and exposes only light,dark themes', () => {
  localStorage.setItem('pettoflow_theme', 'ledger')

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  )

  expect(screen.getByText('light')).toBeInTheDocument()
  expect(screen.getByText('light,dark')).toBeInTheDocument()
})
