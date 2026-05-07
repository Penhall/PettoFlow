import { useEffect, useState } from 'react'
import { useTenant } from '../../hooks/useTenant.js'
import { listTenantAuditLogs } from '../../lib/billingApi.js'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function AuditTimeline() {
  const { activeTenant, activeTenantId } = useTenant()
  const [items, setItems] = useState([])
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeTenantId) return

    let active = true

    async function loadAuditTimeline() {
      setLoading(true)
      setError('')

      try {
        const data = await listTenantAuditLogs(activeTenantId, {
          action: actionFilter,
          limit: 80,
        })
        if (active) setItems(data.items ?? [])
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar auditoria.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAuditTimeline()

    return () => {
      active = false
    }
  }, [activeTenantId, actionFilter])

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Timeline de auditoria</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Eventos recentes de segurança e operação para {activeTenant?.name ?? 'o espaço de trabalho ativo'}.
          </p>
        </div>

        <input
          type="text"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          placeholder="Filtrar por prefixo de ação"
          style={{
            minWidth: 240,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            padding: '10px 14px',
          }}
        />
      </header>

      {error && <div style={{ color: '#fecaca' }}>{error}</div>}
      {loading ? (
        <div>Carregando auditoria...</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)' }}>Nenhum evento encontrado para o filtro atual.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                background: 'var(--card-bg)',
                padding: 16,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{item.action}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(item.created_at)}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Recurso: {item.resource_type} {item.resource_id ? `#${item.resource_id}` : ''}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 12,
                  background: 'color-mix(in srgb, var(--card-bg) 65%, black)',
                  color: 'var(--text-secondary)',
                  overflowX: 'auto',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(item.metadata ?? {}, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
