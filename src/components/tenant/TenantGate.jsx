import { useTenant } from '../../hooks/useTenant.js'

function TenantSelection({ tenants, onSelect }) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="tenant-selection-title">
        <div className="auth-copy">
          <span className="auth-eyebrow">NexusCRM</span>
          <h1 id="tenant-selection-title">Selecione um espaço de trabalho</h1>
          <p>Escolha o espaço de trabalho em que deseja operar antes de acessar o dashboard.</p>
        </div>

        <div className="auth-form" role="list" aria-label="Espaços de trabalho disponíveis">
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
    return <div className="loading-screen">Carregando espaços de trabalho do NexusCRM...</div>
  }

  if (error) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-copy">
            <span className="auth-eyebrow">NexusCRM</span>
            <h1>Erro ao carregar espaços de trabalho</h1>
            <p>{error}</p>
          </div>

          <button type="button" className="auth-submit" onClick={() => refreshTenants()}>
            Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  // Se tem tenants mas nenhum selecionado, mostra seletor
  if (hasTenant && !activeTenantId) {
    return <TenantSelection tenants={tenants} onSelect={setActiveTenant} />
  }

  // Se não tem tenant OU tem tenant ativo, renderiza o app
  // Usuários sem workspace entram no app normalmente e criam workspace via Settings > Workspace
  return children
}
