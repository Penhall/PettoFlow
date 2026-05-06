import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TenantSwitcher from './TenantSwitcher.jsx'

const useTenantMock = vi.fn()

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => useTenantMock(),
}))

describe('TenantSwitcher', () => {
  it('mostra o nome do workspace atual quando existe apenas um tenant', () => {
    useTenantMock.mockReturnValue({
      tenants: [{ id: 'tenant-1', name: 'Workspace A' }],
      activeTenantId: 'tenant-1',
      setActiveTenant: vi.fn(),
    })

    render(<TenantSwitcher />)

    expect(screen.getByText('Workspace A')).toBeTruthy()
  })

  it('permite alternar entre tenants acessiveis', () => {
    const setActiveTenant = vi.fn()
    useTenantMock.mockReturnValue({
      tenants: [
        { id: 'tenant-1', name: 'Workspace A' },
        { id: 'tenant-2', name: 'Workspace B' },
      ],
      activeTenantId: 'tenant-1',
      setActiveTenant,
    })

    render(<TenantSwitcher />)

    const combobox = screen.getByRole('combobox', { name: /workspace ativo/i })

    expect(screen.queryByText('Selecione um workspace')).not.toBeInTheDocument()

    fireEvent.change(combobox, {
      target: { value: 'tenant-2' },
    })

    expect(setActiveTenant).toHaveBeenCalledWith('tenant-2')
  })
})
