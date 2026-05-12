import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WorkspaceOnboarding from './WorkspaceOnboarding.jsx'

const createWorkspaceMock = vi.fn()

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => ({
    createWorkspace: createWorkspaceMock,
  }),
}))

describe('WorkspaceOnboarding', () => {
  it('valida nome obrigatório antes de criar espaço de trabalho', async () => {
    createWorkspaceMock.mockResolvedValue({ tenant: { id: 'tenant-1' } })

    render(<WorkspaceOnboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'Criar espaço de trabalho' }))

    expect(screen.getByText('Informe o nome do espaço de trabalho.')).toBeTruthy()
    expect(createWorkspaceMock).not.toHaveBeenCalled()
  })

  it('envia nome e slug quando a validacao passa', async () => {
    createWorkspaceMock.mockResolvedValue({ tenant: { id: 'tenant-1' } })

    render(<WorkspaceOnboarding />)

    fireEvent.change(screen.getByLabelText('Nome do espaço de trabalho'), {
      target: { value: 'Workspace Alpha' },
    })

    fireEvent.change(screen.getByLabelText('Slug do espaço de trabalho'), {
      target: { value: 'workspace-alpha' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Criar espaço de trabalho' }))

    await waitFor(() => {
      expect(createWorkspaceMock).toHaveBeenCalledWith({
        name: 'Workspace Alpha',
        slug: 'workspace-alpha',
      })
    })
  })

  it('renderiza em modo embed sem wrapper auth-shell', () => {
    render(<WorkspaceOnboarding embed />)

    expect(screen.getByText('Criar seu espaço de trabalho')).toBeTruthy()
    expect(screen.getByLabelText('Nome do espaço de trabalho')).toBeTruthy()
    expect(screen.getByLabelText('Slug do espaço de trabalho')).toBeTruthy()

    // No modo embed, o título deve ser h2 em vez de h1
    expect(screen.getByRole('heading', { level: 2, name: 'Criar seu espaço de trabalho' })).toBeTruthy()
  })
})
