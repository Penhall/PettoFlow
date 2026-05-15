import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (typeof window !== 'undefined' && window.__NEXUS_STRICT_OWNERSHIP__ === undefined) {
  window.__NEXUS_STRICT_OWNERSHIP__ = true
}

afterEach(() => {
  cleanup()
})
