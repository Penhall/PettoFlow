// src/components/Settings/CommandForm.jsx
import { useState } from 'react'
import { createCommand, updateCommand } from '../../lib/botCommands.js'

const MULTI_ACTIONS = [
  { value: '', label: '— selecione —' },
  { value: 'finance.balance', label: 'Ver saldo' },
  { value: 'finance.list', label: 'Ver extrato' },
  { value: 'tasks.list', label: 'Listar tarefas' },
  { value: 'activities.list', label: 'Listar atividades' },
]

function buildActions(type, shortcutData, templateData, multiData) {
  if (type === 'shortcut') {
    return [{
      action: 'finance.record',
      params: {
        direction: shortcutData.direction,
        description: shortcutData.description,
        amount: parseFloat(shortcutData.amount) || 0,
      },
    }]
  }
  if (type === 'template') {
    return [{
      action: 'activities.log',
      params: { type: templateData.activityType, text: templateData.text },
    }]
  }
  if (type === 'multi') {
    return multiData.filter((a) => a !== '').map((action) => ({ action, params: {} }))
  }
  return []
}

export default function CommandForm({ command, onSave, onCancel }) {
  const isEdit = !!command

  const [trigger, setTrigger] = useState(command?.trigger ?? '/')
  const [description, setDescription] = useState(command?.description ?? '')
  const [type, setType] = useState(command?.type ?? 'shortcut')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Shortcut fields
  const [shortcutDirection, setShortcutDirection] = useState(
    command?.actions?.[0]?.params?.direction ?? 'out'
  )
  const [shortcutDescription, setShortcutDescription] = useState(
    command?.actions?.[0]?.params?.description ?? ''
  )
  const [shortcutAmount, setShortcutAmount] = useState(
    String(command?.actions?.[0]?.params?.amount ?? '')
  )

  // Template fields
  const [templateActivityType, setTemplateActivityType] = useState(
    command?.actions?.[0]?.params?.type ?? 'meeting'
  )
  const [templateText, setTemplateText] = useState(
    command?.actions?.[0]?.params?.text ?? ''
  )

  // Multi fields
  const [multiActions, setMultiActions] = useState(
    command?.type === 'multi'
      ? command.actions.map((a) => a.action)
      : ['', '']
  )

  async function handleSubmit() {
    if (!trigger.startsWith('/') || trigger.length < 2) {
      setError('Trigger deve começar com / e ter pelo menos 2 caracteres')
      return
    }
    if (!description.trim()) {
      setError('Descrição é obrigatória')
      return
    }

    const actions = buildActions(
      type,
      { direction: shortcutDirection, description: shortcutDescription, amount: shortcutAmount },
      { activityType: templateActivityType, text: templateText },
      multiActions
    )

    const payload = {
      trigger: trigger.trim(),
      description: description.trim(),
      type,
      actions,
      examples: [],
      category: 'custom',
    }

    setSaving(true)
    setError(null)
    try {
      let result
      if (isEdit) {
        result = await updateCommand(command.id, payload)
      } else {
        result = await createCommand(payload)
      }
      onSave(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <h3 style={{ margin: '0 0 16px' }}>{isEdit ? 'Editar Comando' : 'Novo Comando'}</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* Trigger */}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Trigger</span>
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="/meu-comando"
            disabled={isEdit}
          />
          <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
            Deve começar com /. Ex: /cafe, /fim-de-dia
          </span>
        </label>

        {/* Descrição */}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que este comando faz"
          />
        </label>

        {/* Tipo */}
        {!isEdit && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="shortcut">Atalho — registra uma transação com valores fixos</option>
              <option value="template">Template — registra atividade com texto pré-definido</option>
              <option value="multi">Multi-ação — executa várias ações em sequência</option>
            </select>
          </label>
        )}

        {/* Shortcut fields */}
        {type === 'shortcut' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Configuração do Atalho</p>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Tipo</span>
              <select value={shortcutDirection} onChange={(e) => setShortcutDirection(e.target.value)}>
                <option value="out">Saída (gasto)</option>
                <option value="in">Entrada (receita)</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Descrição da transação</span>
              <input value={shortcutDescription} onChange={(e) => setShortcutDescription(e.target.value)} placeholder="café, almoço, uber..." />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Valor (R$)</span>
              <input type="number" value={shortcutAmount} onChange={(e) => setShortcutAmount(e.target.value)} placeholder="0,00" min="0" step="0.01" />
            </label>
          </div>
        )}

        {/* Template fields */}
        {type === 'template' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Configuração do Template</p>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Tipo de atividade</span>
              <select value={templateActivityType} onChange={(e) => setTemplateActivityType(e.target.value)}>
                <option value="meeting">Reunião</option>
                <option value="note">Nota</option>
                <option value="call">Ligação</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82em' }}>Título padrão</span>
              <input value={templateText} onChange={(e) => setTemplateText(e.target.value)} placeholder="Reunião semanal de equipe" />
            </label>
          </div>
        )}

        {/* Multi fields */}
        {type === 'multi' && (
          <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.83em', fontWeight: 600 }}>Sequência de Ações (até 5)</p>
            {multiActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)', minWidth: 20 }}>{i + 1}.</span>
                <select
                  value={action}
                  onChange={(e) => {
                    const updated = [...multiActions]
                    updated[i] = e.target.value
                    setMultiActions(updated)
                  }}
                  style={{ flex: 1 }}
                >
                  {MULTI_ACTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {multiActions.length > 2 && (
                  <button
                    onClick={() => setMultiActions(multiActions.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {multiActions.length < 5 && (
              <button
                onClick={() => setMultiActions([...multiActions, ''])}
                style={{ alignSelf: 'start', fontSize: '0.85em' }}
              >
                + Ação
              </button>
            )}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', margin: 0, fontSize: '0.85em' }}>❌ {error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar comando'}
          </button>
        </div>
      </div>
    </div>
  )
}
