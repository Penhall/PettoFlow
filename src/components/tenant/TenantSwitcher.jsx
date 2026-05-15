import { useTenant } from '../../hooks/useTenant.js'
import { PRODUCT } from '../../content/uxText.js'

export default function TenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant()

  if (!tenants.length) return null

  if (tenants.length === 1) {
    return (
      <div className="tenant-switcher tenant-switcher--single" aria-label={`${PRODUCT.workspace} ativo`}>
        <strong>{tenants[0].name}</strong>
      </div>
    )
  }

  return (
    <div className="tenant-switcher">
      <select
        id="tenant-switcher-select"
        className="tenant-switcher__select"
        aria-label={`${PRODUCT.workspace} ativo`}
        value={activeTenantId ?? ''}
        onChange={(event) => setActiveTenant(event.target.value)}
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
    </div>
  )
}
