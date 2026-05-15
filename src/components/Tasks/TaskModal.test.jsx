import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskModal from './TaskModal.jsx'
import { fail } from '../../lib/mutationResult.js'

vi.mock('../../hooks/useTenant.js', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1' }),
}))

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({ accounts: [] }),
}))

vi.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({ payees: [], addPayee: vi.fn() }),
}))

vi.mock('../../hooks/useFinCategories', () => ({
  useFinCategories: () => ({ groups: [], categories: [] }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({ addTransaction: vi.fn() }),
}))

vi.mock('../../hooks/useReceivables', () => ({
  useReceivables: () => ({ listReceivables: () => [], invoiceReceivable: vi.fn() }),
}))

describe('TaskModal mutation semantics', () => {
  it('does not close or clear user input when save persistence fails', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockResolvedValue(
      fail(new Error('Supabase SQL insert failed'), { operation: 'tasks.add' })
    )

    render(
      <TaskModal
        task={null}
        onSave={onSave}
        onClose={onClose}
        team={[]}
        clients={[]}
        tasks={[]}
        columns={[{ id: 1, name: 'A Fazer' }]}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Nome da tarefa'), { target: { value: 'Persist me' } })
    fireEvent.click(screen.getByRole('button', { name: /criar tarefa/i }))

    await waitFor(() => {
      expect(screen.getByText('Não foi possível salvar a alteração. Revise os dados e tente novamente.')).toBeInTheDocument()
    })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Persist me')).toBeInTheDocument()
  })
})
