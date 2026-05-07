import { lazy } from 'react'

const STORAGE_PREFIX = 'nexuscrm_lazy_retry:'
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function lazyWithRetry(importer, cacheKey) {
  return lazy(async () => {
    const storageKey = `${STORAGE_PREFIX}${cacheKey}`
    const hasRetried =
      typeof window !== 'undefined' &&
      typeof window.sessionStorage !== 'undefined' &&
      window.sessionStorage.getItem(storageKey) === '1'

    try {
      const module = await importer()

      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem(storageKey)
      }

      return module
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const shouldReload =
        typeof window !== 'undefined' &&
        typeof window.sessionStorage !== 'undefined' &&
        CHUNK_ERROR_PATTERN.test(message) &&
        !hasRetried

      if (shouldReload) {
        window.sessionStorage.setItem(storageKey, '1')
        window.location.reload()
        return new Promise(() => {})
      }

      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem(storageKey)
      }

      throw error
    }
  })
}
