import { useEffect, useState, useCallback } from 'react'
import { listCommands, toggleCommand, deleteCommand, seedDefaultCommands } from '../../lib/botCommands.js'
import { countCommandFailure } from '../../lib/diagnostics.js'
import { normalizeError } from '../../lib/mutationResult.js'
import { useTenant } from '../../hooks/useTenant.js'
import { EMPTY_STATE_TEXT, ERROR_TEXT, LOADING_TEXT, SETTINGS_TEXT } from '../../content/uxText.js'
import CommandForm from './CommandForm.jsx'

function flattenGroup(commands, groupName) {
  const items = commands.filter(c => c.category === groupName)
  return items.length > 0 ? { label: groupName, items } : null
}

const GROUP_LABELS = {
  tasks: 'Tarefas',
  activities: 'Atividades',
  finance: 'Finanças',
  custom: 'Personalizados',
}

export default function CommandsSection() {
  const { activeTenantId } = useTenant()
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('builtin') // 'builtin' | 'custom'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!activeTenantId) {
        setCommands([])
        return
      }
      const data = await listCommands(activeTenantId)
      setCommands(data?.commands ?? [])
    } catch (err) {
      setError(normalizeError(err, { operation: 'commands.load' }).message || ERROR_TEXT.commands)
      countCommandFailure()
    } finally {
      setLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => { load() }, [load])

  const builtins = commands.filter(c => c.type === 'builtin')
  const custom = commands.filter(c => c.type !== 'builtin')

  const grouped = [flattenGroup(commands, 'tasks'), flattenGroup(commands, 'activities'), flattenGroup(commands, 'finance'), flattenGroup(commands, 'custom')].filter(Boolean)

  async function handleToggle(cmd) {
    try {
      await toggleCommand(activeTenantId, cmd.id, !cmd.is_active)
      setCommands(prev => prev.map(c => c.id === cmd.id ? { ...c, is_active: !c.is_active } : c))
    } catch (err) {
      setError(normalizeError(err, { operation: 'commands.toggle' }).message)
      countCommandFailure()
    }
  }

  async function handleDelete(cmd) {
    if (!confirm(`Deletar comando "${cmd.trigger}"?`)) return
    try {
      await deleteCommand(activeTenantId, cmd.id)
      setCommands(prev => prev.filter(c => c.id !== cmd.id))
    } catch (err) {
      setError(normalizeError(err, { operation: 'commands.delete' }).message)
      countCommandFailure()
    }
  }

  async function handleSeed() {
    try {
      const data = await seedDefaultCommands(activeTenantId)
      setCommands(prev => {
        const existing = new Map(prev.map(c => [c.id, c]))
        for (const cmd of data?.commands ?? []) {
          existing.set(cmd.id, cmd)
        }
        return [...existing.values()]
      })
    } catch (err) {
      setError(normalizeError(err, { operation: 'commands.seed' }).message)
      countCommandFailure()
    }
  }

  function renderCommandRow(cmd) {
    const isBuiltin = cmd.type === 'builtin'
    return (
      <div
        key={cmd.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          opacity: cmd.is_active ? 1 : 0.5,
        }}
      >
        <code style={{ minWidth: 110, fontWeight: 600 }}>{cmd.trigger}</code>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9em' }}>{cmd.description}</div>
          {cmd.examples?.length > 0 && (
            <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginTop: 2 }}>
              💬 {cmd.examples.join(', ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => handleToggle(cmd)}
            title={cmd.is_active ? 'Desativar' : 'Ativar'}
            style={{ fontSize: '0.85em', padding: '4px 8px' }}
          >
            {cmd.is_active ? '⏸' : '▶'}
          </button>
          {!isBuiltin && (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() => { setEditing(cmd); setShowForm(true) }}
                title="Editar"
                style={{ fontSize: '0.85em', padding: '4px 8px' }}
              >
                ✏️
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handleDelete(cmd)}
                title="Excluir"
                style={{ fontSize: '0.85em', padding: '4px 8px', color: '#fecaca' }}
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!activeTenantId) {
    return <div style={{ color: 'var(--text-secondary)' }}>{SETTINGS_TEXT.noActiveCommandsWorkspace}</div>
  }

  if (loading && commands.length === 0) {
    return <div style={{ color: 'var(--text-secondary)' }}>{LOADING_TEXT.commands}</div>
  }

  if (error) {
    return <div style={{ color: '#fecaca', marginBottom: 12 }}>{error}</div>
  }

  if (commands.length === 0) {
    return (
      <div style={{ maxWidth: 600 }}>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          {EMPTY_STATE_TEXT.noCommands}
        </p>
        <button type="button" className="icon-btn" onClick={handleSeed}>
          Instalar comandos padrão
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setTab('builtin')}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: tab === 'builtin' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
            background: tab === 'builtin' ? 'var(--primary)' : 'transparent',
            color: tab === 'builtin' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          🔧 Built-in ({builtins.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: tab === 'custom' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
            background: tab === 'custom' ? 'var(--primary)' : 'transparent',
            color: tab === 'custom' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          ✨ Personalizados ({custom.length})
        </button>
        {tab === 'custom' && (
          <button type="button" className="icon-btn" onClick={() => { setEditing(null); setShowForm(true) }}>
            + Novo
          </button>
        )}
      </div>

      {/* List */}
      {tab === 'builtin' && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
          {grouped.filter(g => g.label !== 'custom').map(group => (
            <div key={group.label}>
              <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', fontSize: '0.8em', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {GROUP_LABELS[group.label] || group.label}
              </div>
              {group.items.filter(c => c.type === 'builtin').map(renderCommandRow)}
            </div>
          ))}
        </div>
      )}

      {tab === 'custom' && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
          {custom.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              {EMPTY_STATE_TEXT.noCustomCommands}
            </div>
          ) : (
            <div>
              {custom.map(renderCommandRow)}
            </div>
          )}
        </div>
      )}

      {/* Re-seed */}
      <div style={{ marginTop: 16 }}>
        <button type="button" className="icon-btn" onClick={handleSeed} style={{ fontSize: '0.85em' }}>
          Restaurar comandos padrão
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div style={{ background: 'var(--card-bg, #1a1a2e)', padding: 24, borderRadius: 16, maxWidth: 520, width: '90%' }}>
            <CommandForm
              tenantId={activeTenantId}
              command={editing}
              onSave={(result) => {
                if (editing) {
                  setCommands(prev => prev.map(c => c.id === result.id ? result : c))
                } else {
                  setCommands(prev => [...prev, result])
                }
                setShowForm(false)
                setEditing(null)
              }}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
