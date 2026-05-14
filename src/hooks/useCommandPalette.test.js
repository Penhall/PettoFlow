import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommandPalette } from './useCommandPalette.js'

function fireKeydown(key, modifiers = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
  })
  window.dispatchEvent(event)
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    // Default: non-mac environment, no userAgentData
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens on Ctrl+K (Windows/Linux via navigator.platform fallback)', () => {
    const { result } = renderHook(() => useCommandPalette([], [], []))

    expect(result.current.isOpen).toBe(false)

    act(() => { fireKeydown('k', { ctrlKey: true }) })

    expect(result.current.isOpen).toBe(true)
  })

  it('opens on Cmd+K (Mac via navigator.userAgentData.platform)', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'macOS' },
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useCommandPalette([], [], []))

    act(() => { fireKeydown('k', { metaKey: true }) })

    expect(result.current.isOpen).toBe(true)
  })

  it('opens on Cmd+K (Mac via navigator.platform fallback when userAgentData absent)', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useCommandPalette([], [], []))

    act(() => { fireKeydown('k', { metaKey: true }) })

    expect(result.current.isOpen).toBe(true)
  })

  it('closes on Escape and clears query', () => {
    const { result } = renderHook(() => useCommandPalette([], [], []))

    act(() => { fireKeydown('k', { ctrlKey: true }) })
    expect(result.current.isOpen).toBe(true)

    act(() => { result.current.setQuery('hello') })
    act(() => { fireKeydown('Escape') })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.query).toBe('')
  })

  it('does not open when only Ctrl is pressed without K', () => {
    const { result } = renderHook(() => useCommandPalette([], [], []))

    act(() => { fireKeydown('Control', { ctrlKey: true }) })

    expect(result.current.isOpen).toBe(false)
  })

  it('filters tasks by query', () => {
    const tasks = [
      { id: 1, title: 'Review PR' },
      { id: 2, title: 'Fix bug' },
    ]
    const { result } = renderHook(() => useCommandPalette(tasks, [], []))

    act(() => { result.current.setQuery('review') })

    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0].label).toBe('Review PR')
  })

  it('returns empty results when query is blank', () => {
    const tasks = [{ id: 1, title: 'Something' }]
    const { result } = renderHook(() => useCommandPalette(tasks, [], []))

    act(() => { result.current.setQuery('') })

    expect(result.current.results).toHaveLength(0)
  })
})
