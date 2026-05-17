import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useTenant } from './useTenant.js'

/**
 * Hook para verificar se uma feature está habilitada no plano do tenant ativo.
 *
 * Uso:
 *   const { isEnabled, loading } = usePlanFeature('multi_user')
 *   if (isEnabled) { /* mostra UI de colaboração *\/ }
 */
export function usePlanFeature(feature) {
  const { activeTenantId, activeTenant } = useTenant()
  const [isEnabled, setIsEnabled] = useState(null)
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    if (!activeTenantId) {
      setIsEnabled(null)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('check_tenant_feature', {
        p_tenant_id: activeTenantId,
        p_feature: feature,
      })

      if (error) {
        setIsEnabled(null)
      } else {
        setIsEnabled(data === true)
      }
    } catch {
      setIsEnabled(null)
    } finally {
      setLoading(false)
    }
  }, [activeTenantId, feature, activeTenant])

  useEffect(() => {
    check()
  }, [check])

  return { isEnabled, loading, recheck: check }
}
