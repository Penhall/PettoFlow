import { useTenant } from '../../hooks/useTenant.js'

export default function TenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant()

  if (!tenants.length) return null

  if (tenants.length === 1) {
    return (
      <div className="tenant-switcher tenant-switcher--single">
        <span className="tenant-switcher-label">Workspace</span>
        <strong>{tenants[0].name}</strong>
      </div>
    )
  }

  return (
    <label className="tenant-switcher" htmlFor="tenant-switcher-select">
      <span className="tenant-switcher-label">Workspace</span>
      <select
        id="tenant-switcher-select"
        aria-label="Selecionar workspace ativo"
        value={activeTenantId ?? ''}
        onChange={(event) => setActiveTenant(event.target.value)}
      >
        <option value="" disabled>Selecione um workspace</option>
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
    </label>
  )
}
