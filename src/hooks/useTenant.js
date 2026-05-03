import { useContext } from 'react'
import { TenantContext } from '../context/tenantContext.js'

export function useTenant() {
  const context = useContext(TenantContext)

  if (!context) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider.')
  }

  return context
}
