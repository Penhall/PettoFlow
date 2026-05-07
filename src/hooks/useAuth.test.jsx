import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

import { supabase } from '../lib/supabaseClient.js'
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
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
    supabase.rpc.mockResolvedValue({ data: false, error: null })
  })

  it('falha com erro claro fora do AuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<OutsideProvider />)).toThrow('useAuth deve ser usado dentro de um AuthProvider.')
    consoleErrorSpy.mockRestore()
  })

  it('funciona dentro do AuthProvider', async () => {
    render(
      <AuthProvider>
        <InsideProvider />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy()
    })
  })

  it('sai do loading inicial quando getSession falha', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabase.auth.getSession.mockRejectedValueOnce(new Error('network exploded'))

    render(
      <AuthProvider>
        <InsideProvider />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy()
    })

    consoleErrorSpy.mockRestore()
  })
})
