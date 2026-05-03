import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute.jsx'

const useAuthMock = vi.fn()

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => useAuthMock(),
}))

describe('ProtectedRoute', () => {
  it('mostra tela de loading enquanto a sessao carrega', () => {
    useAuthMock.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      isConfigured: true,
    })

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Carregando NexusCRM...')).toBeTruthy()
  })

  it('mostra login quando nao existe sessao autenticada', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      isConfigured: true,
    })

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Entrar no NexusCRM')).toBeTruthy()
  })

  it('renderiza children quando existe sessao autenticada', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isConfigured: true,
    })

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Dashboard')).toBeTruthy()
  })
})
