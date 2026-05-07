import AuthLayout from '../components/auth/AuthLayout.jsx'
import { useAuth } from '../hooks/useAuth.js'
import AdminPanel from './AdminPanel.jsx'

export default function AdminRoute() {
  const { isPlatformAdmin } = useAuth()

  if (!isPlatformAdmin) {
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

  return <AdminPanel />
}
