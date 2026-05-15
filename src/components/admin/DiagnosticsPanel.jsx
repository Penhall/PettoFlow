import { useCallback, useEffect, useState } from 'react'
import {
  clearEventBuffer,
  getEventBuffer,
  getTelemetrySnapshot,
  resetAllDiagnostics,
  resetTelemetry,
} from '../../lib/diagnostics.js'
import { getAllFlags, setFlag } from '../../lib/featureFlags.js'

const COUNTER_GROUPS = [
  {
    label: 'Onboarding',
    keys: ['onboarding_completed', 'onboarding_dropoff', 'onboarding_retries', 'onboarding_interruptions', 'overlay_interruptions'],
  },
  {
    label: 'Telegram',
    keys: ['telegram_failures'],
  },
  {
    label: 'Read Path',
    keys: ['read_failures', 'read_retries', 'read_stale', 'read_interrupted', 'read_unauthorized', 'stale_reads_detected'],
  },
  {
    label: 'Mutations',
    keys: ['mutation_failures', 'persistence_rejections', 'stale_mutation_rejections'],
  },
  {
    label: 'Transactional Integrity',
    keys: ['partial_transaction_failures', 'orphan_state_risks', 'idempotency_violations', 'integrity_violations', 'rollback_attempts'],
  },
  {
    label: 'Bootstrap / Orchestration',
    keys: ['bootstrap_retries', 'transition_conflicts', 'cancellations', 'chunk_load_errors', 'suspense_fallbacks'],
  },
  {
    label: 'Ownership',
    keys: ['ownership_total', 'ownership_implicit'],
  },
  {
    label: 'Recovery',
    keys: ['ux_recovery_attempts', 'retry_loops'],
  },
]

function CounterGroup({ group, snapshot }) {
  const entries = group.keys
    .map((key) => ({ key, value: snapshot[key] ?? 0 }))
    .filter((entry) => entry.value > 0 || true)

  const hasActivity = entries.some((entry) => entry.value > 0)

  return (
    <div className="diag-group" style={{ marginBottom: 16 }}>
      <div className="diag-group__header" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary, #888)' }}>
          {group.label}
        </strong>
        {hasActivity && (
          <span style={{ fontSize: 10, background: 'var(--color-accent, #3b82f6)', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>
            active
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4 }}>
        {entries.map(({ key, value }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px 8px',
              background: value > 0 ? 'var(--color-surface-raised, #f8f9fa)' : 'transparent',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary, #666)' }}>{key}</span>
            <strong style={{ color: value > 0 ? 'var(--color-text, #111)' : 'var(--color-text-tertiary, #bbb)' }}>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventBufferSection({ events, onClear }) {
  const [expanded, setExpanded] = useState(false)
  const recent = events.slice(-20).reverse()

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary, #888)' }}>
          Event Buffer
        </strong>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #888)' }}>({events.length} events)</span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{ fontSize: 11, background: 'none', border: '1px solid var(--color-border, #ddd)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}
        >
          {expanded ? 'hide' : 'show'}
        </button>
        <button
          type="button"
          onClick={onClear}
          style={{ fontSize: 11, background: 'none', border: '1px solid var(--color-border, #ddd)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: 'var(--color-text-danger, #dc2626)' }}
        >
          clear
        </button>
      </div>
      {expanded && (
        <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace', background: 'var(--color-surface-raised, #f8f9fa)', borderRadius: 6, padding: 8 }}>
          {recent.length === 0 ? (
            <span style={{ color: 'var(--color-text-tertiary, #bbb)' }}>no events</span>
          ) : (
            recent.map((event, i) => (
              <div key={i} style={{ marginBottom: 2, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-secondary, #888)', flexShrink: 0 }}>
                  {event.at ? event.at.slice(11, 23) : '?'}
                </span>
                <span style={{ color: 'var(--color-text, #333)' }}>
                  [{event.kind}] {event.label || event.scope || event.phase || event.operation || ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FlagToggleSection({ flags, onToggle }) {
  const entries = Object.entries(flags)

  return (
    <div style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary, #888)', display: 'block', marginBottom: 8 }}>
        Feature Flags
      </strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}>
        {entries.map(([flag, value]) => (
          <label
            key={flag}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' }}
          >
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onToggle(flag, e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--color-text, #333)' }}>{flag}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function DiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState({})
  const [events, setEvents] = useState([])
  const [flags, setFlags] = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)

  const refresh = useCallback(() => {
    setSnapshot(getTelemetrySnapshot())
    setEvents(getEventBuffer())
    setFlags(getAllFlags())
    setLastRefresh(new Date().toISOString().slice(11, 23))
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleResetTelemetry = () => {
    resetTelemetry()
    refresh()
  }

  const handleClearEvents = () => {
    clearEventBuffer()
    refresh()
  }

  const handleResetAll = () => {
    resetAllDiagnostics()
    refresh()
  }

  const handleToggleFlag = (flag, value) => {
    setFlag(flag, value)
    refresh()
  }

  const totalCounters = Object.values(snapshot).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
  const criticalCounters = [
    'mutation_failures',
    'partial_transaction_failures',
    'orphan_state_risks',
    'integrity_violations',
    'bootstrap_retries',
    'read_unauthorized',
    'onboarding_dropoff',
    'telegram_failures',
  ].filter((k) => (snapshot[k] ?? 0) > 0)

  return (
    <div
      className="diagnostics-panel"
      style={{
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Diagnostics Panel</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary, #888)' }}>
            Runtime telemetry — operator view. Auto-refreshes every 3s.
            {lastRefresh ? ` Last: ${lastRefresh}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={refresh}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border, #ddd)', background: 'none', cursor: 'pointer' }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleResetTelemetry}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border, #ddd)', background: 'none', cursor: 'pointer' }}
          >
            Reset Counters
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border-danger, #fca5a5)', background: 'none', cursor: 'pointer', color: 'var(--color-text-danger, #dc2626)' }}
          >
            Reset All
          </button>
        </div>
      </div>

      {criticalCounters.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            background: 'var(--color-warning-surface, #fef3c7)',
            borderRadius: 8,
            border: '1px solid var(--color-warning-border, #fcd34d)',
          }}
        >
          <strong style={{ fontSize: 12, color: 'var(--color-warning-text, #92400e)' }}>
            Attention: {criticalCounters.length} critical counter(s) non-zero
          </strong>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-warning-text, #92400e)' }}>
            {criticalCounters.join(', ')}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--color-surface-raised, #f8f9fa)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 24 }}>
        <span>Total counter events: <strong>{totalCounters}</strong></span>
        <span>Event buffer size: <strong>{events.length}</strong></span>
        <span>Flags active: <strong>{Object.values(flags).filter(Boolean).length}/{Object.keys(flags).length}</strong></span>
      </div>

      {COUNTER_GROUPS.map((group) => (
        <CounterGroup key={group.label} group={group} snapshot={snapshot} />
      ))}

      <EventBufferSection events={events} onClear={handleClearEvents} />
      <FlagToggleSection flags={flags} onToggle={handleToggleFlag} />
    </div>
  )
}
