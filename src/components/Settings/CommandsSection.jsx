// src/components/Settings/CommandsSection.jsx
import { useState, useEffect, useCallback } from 'react'
import { listCommands, toggleCommand, deleteCommand } from '../../lib/botCommands.js'
import CommandForm from './CommandForm.jsx'

const CATEGORY_LABELS = {
  tasks: '📋 Tarefas',
  activities: '📝 Atividades',
  finance: '💰 Finanças',
  custom: '⚡ Personalizados',
}

const TYPE_LABELS = {
  builtin: 'Built-in',
  shortcut: 'Atalho',
  template: 'Template',
  multi: 'Multi',
}

export default function CommandsSection() {
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('builtin')
  const [showForm, setShowForm] = useState(false)
  const [editingCommand, setEditingCommand] = useState(null)
  const [saving, setSaving] = useState(null) // id do comando sendo salvo

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listCommands()
      setCommands(data)
    } catch (err) {
      console.error('Erro ao carregar comandos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(cmd) {
    setSaving(cmd.id)
    try {
      await toggleCommand(cmd.id, !cmd.is_active)
      setCommands((prev) =>
        prev.map((c) => c.id === cmd.id ? { ...c, is_active: !c.is_active } : c)
      )
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(cmd) {
    if (!confirm(`Remover o comando ${cmd.trigger}?`)) return
    setSaving(cmd.id)
    try {
      await deleteCommand(cmd.id)
      setCommands((prev) => prev.filter((c) => c.id !== cmd.id))
    } finally {
      setSaving(null)
    }
  }

  function handleFormSave(newCmd) {
    if (editingCommand) {
      setCommands((prev) => prev.map((c) => c.id === newCmd.id ? newCmd : c))
    } else {
      setCommands((prev) => [...prev, newCmd])
    }
    setShowForm(false)
    setEditingCommand(null)
  }

  const builtins = commands.filter((c) => c.type === 'builtin')
  const customs = commands.filter((c) => c.type !== 'builtin')

  const grouped = builtins.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando comandos...</p>

  if (showForm) {
    return (
      <CommandForm
        command={editingCommand}
        onSave={handleFormSave}
        onCancel={() => { setShowForm(false); setEditingCommand(null) }}
      />
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>⚡ Comandos do Bot</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            Gerencie e crie comandos personalizados
          </p>
        </div>
        <button onClick={() => { setEditingCommand(null); setShowForm(true) }}>+ Novo</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'builtin', label: '🔧 Built-in' },
          { id: 'custom', label: '✨ Personalizados' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Built-in tab */}
      {activeTab === 'builtin' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {['tasks', 'activities', 'finance'].map((cat) => (
            <div key={cat}>
              <p style={{ margin: '0 0 6px', fontSize: '0.8em', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {CATEGORY_LABELS[cat]}
              </p>
              <div style={{ display: 'grid', gap: 4 }}>
                {(grouped[cat] ?? []).map((cmd) => (
                  <CommandRow
                    key={cmd.id}
                    cmd={cmd}
                    saving={saving === cmd.id}
                    onToggle={() => handleToggle(cmd)}
                    showEdit={false}
                    showDelete={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom tab */}
      {activeTab === 'custom' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {customs.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
              Nenhum comando personalizado ainda.<br />Clique em &quot;+ Novo&quot; para criar.
            </p>
          )}
          {customs.map((cmd) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              saving={saving === cmd.id}
              onToggle={() => handleToggle(cmd)}
              onEdit={() => { setEditingCommand(cmd); setShowForm(true) }}
              onDelete={() => handleDelete(cmd)}
              showEdit
              showDelete={!cmd.is_default}
            />
          ))}
          <button
            onClick={() => { setEditingCommand(null); setShowForm(true) }}
            style={{ marginTop: 8, alignSelf: 'start' }}
          >
            + Adicionar comando
          </button>
        </div>
      )}
    </div>
  )
}

function CommandRow({ cmd, saving, onToggle, onEdit, onDelete, showEdit, showDelete }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        opacity: cmd.is_active ? 1 : 0.5,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: '0.9em', fontWeight: 600 }}>{cmd.trigger}</code>
          <span style={{
            fontSize: '0.7em', padding: '1px 6px',
            background: 'var(--bg-secondary)', borderRadius: 10,
            color: 'var(--text-secondary)',
          }}>
            {TYPE_LABELS[cmd.type] ?? cmd.type}
          </span>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: '0.82em', color: 'var(--text-secondary)' }}>
          {cmd.description}
        </p>
        {cmd.examples?.length > 0 && (
          <p style={{ margin: '2px 0 0', fontSize: '0.78em', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            💬 {cmd.examples.slice(0, 2).join(' · ')}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {showEdit && (
          <button onClick={onEdit} style={{ padding: '4px 8px', fontSize: '0.85em' }}>✏️</button>
        )}
        {showDelete && (
          <button onClick={onDelete} disabled={saving} style={{ padding: '4px 8px', fontSize: '0.85em', color: 'var(--color-error, #ef4444)' }}>
            🗑
          </button>
        )}
        <button onClick={onToggle} disabled={saving} style={{ padding: '4px 8px', fontSize: '0.85em' }}>
          {cmd.is_active ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  )
}
