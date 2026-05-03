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
  it('valida nome obrigatorio antes de criar workspace', async () => {
    createWorkspaceMock.mockResolvedValue({ tenant: { id: 'tenant-1' } })

    render(<WorkspaceOnboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'Criar workspace' }))

    expect(screen.getByText('Informe o nome do workspace.')).toBeTruthy()
    expect(createWorkspaceMock).not.toHaveBeenCalled()
  })

  it('envia nome e slug quando a validacao passa', async () => {
    createWorkspaceMock.mockResolvedValue({ tenant: { id: 'tenant-1' } })

    render(<WorkspaceOnboarding />)

    fireEvent.change(screen.getByLabelText('Nome do workspace'), {
      target: { value: 'Workspace Alpha' },
    })

    fireEvent.change(screen.getByLabelText('Slug do workspace'), {
      target: { value: 'workspace-alpha' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Criar workspace' }))

    await waitFor(() => {
      expect(createWorkspaceMock).toHaveBeenCalledWith({
        name: 'Workspace Alpha',
        slug: 'workspace-alpha',
      })
    })
  })
})
