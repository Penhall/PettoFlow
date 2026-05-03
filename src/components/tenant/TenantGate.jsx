import { useTenant } from '../../hooks/useTenant.js'
import WorkspaceOnboarding from './WorkspaceOnboarding.jsx'

function TenantSelection({ tenants, onSelect }) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="tenant-selection-title">
        <div className="auth-copy">
          <span className="auth-eyebrow">NexusCRM</span>
          <h1 id="tenant-selection-title">Selecione um workspace</h1>
          <p>Escolha o workspace em que deseja operar antes de acessar o dashboard.</p>
        </div>

        <div className="auth-form" role="list" aria-label="Workspaces disponiveis">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              className="auth-submit"
              onClick={() => onSelect(tenant.id)}
            >
              {tenant.name}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

export default function TenantGate({ children }) {
  const { loading, error, hasTenant, activeTenantId, tenants, setActiveTenant, refreshTenants } = useTenant()

  if (loading) {
    return <div className="loading-screen">Carregando workspaces do NexusCRM...</div>
  }

  if (error) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-copy">
            <span className="auth-eyebrow">NexusCRM</span>
            <h1>Erro ao carregar workspaces</h1>
            <p>{error}</p>
          </div>

          <button type="button" className="auth-submit" onClick={() => refreshTenants()}>
            Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  if (!hasTenant) {
    return <WorkspaceOnboarding />
  }

  if (!activeTenantId) {
    return <TenantSelection tenants={tenants} onSelect={setActiveTenant} />
  }

  return children
}
