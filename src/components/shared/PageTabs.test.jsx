import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PageTabs from './PageTabs.jsx'

describe('PageTabs', () => {
  it('renders accessible tabs and notifies when the active tab changes', () => {
    const onChange = vi.fn()

    render(
      <PageTabs
        items={[
          { id: 'timeline', label: 'Timeline' },
          { id: 'templates', label: 'Modelos' },
        ]}
        activeId="timeline"
        onChange={onChange}
      />
    )

    const timelineTab = screen.getByRole('tab', { name: 'Timeline' })
    const templatesTab = screen.getByRole('tab', { name: 'Modelos' })

    expect(timelineTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(templatesTab)

    expect(onChange).toHaveBeenCalledWith('templates')
  })
})
