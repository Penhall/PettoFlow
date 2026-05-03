import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { useAuth } from './useAuth.js'

function OutsideProvider() {
  useAuth()
  return null
}

function InsideProvider() {
  const auth = useAuth()
  return <span>{auth.loading ? 'loading' : 'ready'}</span>
}

describe('useAuth', () => {
  it('falha com erro claro fora do AuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<OutsideProvider />)).toThrow('useAuth deve ser usado dentro de um AuthProvider.')
    consoleErrorSpy.mockRestore()
  })

  it('funciona dentro do AuthProvider', () => {
    const { getByText } = render(
      <AuthProvider>
        <InsideProvider />
      </AuthProvider>,
    )

    expect(getByText('loading')).toBeTruthy()
  })
})
