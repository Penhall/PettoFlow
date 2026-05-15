import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute.jsx'

const useAuthMock = vi.fn()
const useRuntimeOrchestrationMock = vi.fn()

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../../hooks/useRuntimeOrchestration.js', () => ({
  useRuntimeOrchestration: () => useRuntimeOrchestrationMock(),
}))

describe('ProtectedRoute', () => {
  it('mostra tela de loading enquanto a sessao carrega', () => {
    useAuthMock.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      isConfigured: true,
    })
    useRuntimeOrchestrationMock.mockReturnValue({ phase: 'AUTH_HYDRATING' })

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
    useRuntimeOrchestrationMock.mockReturnValue({ phase: 'BOOTSTRAP_IDLE' })

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
    useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Dashboard')).toBeTruthy()
  })

  it('mostra erro de configuracao quando supabase nao esta configurado', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      isConfigured: false,
    })
    useRuntimeOrchestrationMock.mockReturnValue({ phase: 'BOOTSTRAP_IDLE' })

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Configuracao incompleta')).toBeTruthy()
  })

  describe('auth state transitions (rerender-driven)', () => {
    it('auth loss after authentication shows login — state change triggers rerender', () => {
      // Start authenticated
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: true, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

      const { rerender } = render(
        <ProtectedRoute>
          <div>Dashboard</div>
        </ProtectedRoute>,
      )

      expect(screen.getByText('Dashboard')).toBeTruthy()

      // Auth is lost — isAuthenticated flips to false (real logout/expiry)
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: false, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'BOOTSTRAP_IDLE' })

      act(() => {
        rerender(
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>,
        )
      })

      // Login screen must appear — no stale shell rendering
      expect(screen.getByText('Entrar no NexusCRM')).toBeTruthy()
      expect(screen.queryByText('Dashboard')).toBeNull()
    })

    it('initial loading then authenticated shows children without flash', () => {
      useAuthMock.mockReturnValue({ loading: true, isAuthenticated: false, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'AUTH_HYDRATING' })

      const { rerender } = render(
        <ProtectedRoute>
          <div>Dashboard</div>
        </ProtectedRoute>,
      )

      expect(screen.getByText('Carregando NexusCRM...')).toBeTruthy()

      // Auth resolves
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: true, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

      act(() => {
        rerender(
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>,
        )
      })

      expect(screen.getByText('Dashboard')).toBeTruthy()
      expect(screen.queryByText('Carregando NexusCRM...')).toBeNull()
    })

    it('subsequent auth resolution does not re-show loading screen', () => {
      // Already authenticated
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: true, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

      const { rerender } = render(
        <ProtectedRoute>
          <div>Dashboard</div>
        </ProtectedRoute>,
      )

      expect(screen.getByText('Dashboard')).toBeTruthy()

      // Simulate a rerender where loading becomes true (should not re-show loader)
      // In practice AuthContext prevents this, but the component must be robust.
      // authInitialized is already true so loading: true is ignored.
      useAuthMock.mockReturnValue({ loading: true, isAuthenticated: true, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

      act(() => {
        rerender(
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>,
        )
      })

      // Shell should remain visible — authInitialized prevents loading re-show
      expect(screen.getByText('Dashboard')).toBeTruthy()
      expect(screen.queryByText('Carregando NexusCRM...')).toBeNull()
    })

    it('logout flow: authenticated → unauthenticated shows login, not loading', () => {
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: true, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'APP_READY' })

      const { rerender } = render(
        <ProtectedRoute>
          <div>Dashboard</div>
        </ProtectedRoute>,
      )

      expect(screen.getByText('Dashboard')).toBeTruthy()

      // Logout: session cleared
      useAuthMock.mockReturnValue({ loading: false, isAuthenticated: false, isConfigured: true })
      useRuntimeOrchestrationMock.mockReturnValue({ phase: 'BOOTSTRAP_IDLE' })

      act(() => {
        rerender(
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>,
        )
      })

      // Shows login, not loading — authInitialized stays true
      expect(screen.getByText('Entrar no NexusCRM')).toBeTruthy()
      expect(screen.queryByText('Carregando NexusCRM...')).toBeNull()
    })
  })
})
