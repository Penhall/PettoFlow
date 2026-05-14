import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_TENANT_STORAGE_KEY,
  getRequiredActiveTenantId,
  setRuntimeActiveTenantId,
  setStoredActiveTenantId,
} from './activeTenant.js'

function clearAll() {
  setRuntimeActiveTenantId(null)
  window.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)
}

describe('activeTenant', () => {
  beforeEach(clearAll)
  afterEach(clearAll)

  describe('getRequiredActiveTenantId', () => {
    it('returns the runtime tenant when set', () => {
      setRuntimeActiveTenantId('runtime-uuid')
      expect(getRequiredActiveTenantId()).toBe('runtime-uuid')
    })

    it('falls back to localStorage when runtime variable is null', () => {
      setRuntimeActiveTenantId(null)
      setStoredActiveTenantId('storage-uuid')
      expect(getRequiredActiveTenantId()).toBe('storage-uuid')
    })

    it('throws TENANT_REQUIRED when neither runtime nor localStorage has a tenant', () => {
      setRuntimeActiveTenantId(null)
      window.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)

      expect(() => getRequiredActiveTenantId()).toThrow(
        'Espaço de trabalho ativo obrigatório para operação de negócio.'
      )
    })

    it('attaches TENANT_REQUIRED error code when throwing', () => {
      setRuntimeActiveTenantId(null)
      window.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)

      let caughtError = null
      try {
        getRequiredActiveTenantId()
      } catch (err) {
        caughtError = err
      }

      expect(caughtError).not.toBeNull()
      expect(caughtError.code).toBe('TENANT_REQUIRED')
    })

    it('prefers runtime tenant over localStorage when both exist', () => {
      setRuntimeActiveTenantId('runtime-uuid')
      setStoredActiveTenantId('storage-uuid')
      expect(getRequiredActiveTenantId()).toBe('runtime-uuid')
    })

    it('uses localStorage after runtime is cleared back to null', () => {
      setRuntimeActiveTenantId('runtime-uuid')
      setStoredActiveTenantId('storage-uuid')
      // Simulate TenantContext effect not having fired yet (child-before-parent)
      setRuntimeActiveTenantId(null)
      expect(getRequiredActiveTenantId()).toBe('storage-uuid')
    })
  })
})
