import { useEffect, useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import { useAuth } from '../hooks/useAuth.js'
import AdminPanel from './AdminPanel.jsx'
import ClaimMasterBanner from '../components/admin/ClaimMasterBanner.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function AdminRoute() {
  const { isPlatformAdmin, user, refreshSession } = useAuth()
  const [tableEmpty, setTableEmpty] = useState(null)

  useEffect(() => {
    if (!user || isPlatformAdmin) return
    supabase.rpc('is_platform_admins_table_empty').then(({ data }) => {
      setTableEmpty(Boolean(data))
    })
  }, [user, isPlatformAdmin])

  if (isPlatformAdmin) return <AdminPanel />

  if (user && tableEmpty === null) return null

  if (tableEmpty === true) {
    return <ClaimMasterBanner onClaimed={refreshSession} />
  }

  return (
    <AuthLayout
      title="Acesso administrativo negado"
      description="Esta área interna do NexusCRM exige flag administrativa global."
    >
      <button
        type="button"
        className="auth-submit"
        onClick={() => { window.location.hash = '' }}
      >
        Voltar ao espaço de trabalho
      </button>
    </AuthLayout>
  )
}
