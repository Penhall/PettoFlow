import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OnboardingPanel from './OnboardingPanel.jsx'

describe('OnboardingPanel', () => {
  it('renders checklist progress and tutorial CTA', () => {
    render(
      <OnboardingPanel
        progress={1}
        total={4}
        items={[{ id: 'a', title: 'Criar cliente', description: 'Registrar o primeiro cliente real.' }]}
      />
    )

    expect(screen.getByText(/1 de 4 etapas concluídas/i)).toBeInTheDocument()
    expect(screen.getByText('Criar cliente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abrir tutoriais/i })).toBeInTheDocument()
  })
})
