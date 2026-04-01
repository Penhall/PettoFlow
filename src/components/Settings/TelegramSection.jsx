// src/components/Settings/TelegramSection.jsx
import { useState, useEffect, useCallback } from 'react'
import { getBotConfig, updateBotConfig, deleteBotConfig } from '../../lib/botConfig.js'
import OnboardingWizard from './OnboardingWizard.jsx'

export default function TelegramSection() {
  const [config, setConfig] = useState(undefined) // undefined = loading
  const [saving, setSaving] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [newId, setNewId] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [llmKey, setLlmKey] = useState('')

  const loadConfig = useCallback(async () => {
    try {
      const data = await getBotConfig()
      setConfig(data)
      if (data) setThreshold(String(data.confirmation_threshold ?? 500))
    } catch {
      setConfig(null)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function toggleActive() {
    if (!config) return
    setSaving(true)
    try {
      await updateBotConfig({ is_active: !config.is_active })
      setConfig((prev) => ({ ...prev, is_active: !prev.is_active }))
    } finally {
      setSaving(false)
    }
  }

  async function saveThreshold() {
    const val = parseFloat(threshold.replace(',', '.'))
    if (isNaN(val)) return
    setSaving(true)
    try {
      await updateBotConfig({ confirmation_threshold: val })
    } finally {
      setSaving(false)
    }
  }

  async function addTelegramId() {
    const trimmed = newId.trim()
    if (!trimmed || !config) return
    const updated = [...(config.allowed_telegram_ids ?? []), trimmed]
    setSaving(true)
    try {
      await updateBotConfig({ allowed_telegram_ids: updated })
      setConfig((prev) => ({ ...prev, allowed_telegram_ids: updated }))
      setNewId('')
    } finally {
      setSaving(false)
    }
  }

  async function removeId(id) {
    const updated = config.allowed_telegram_ids.filter((i) => i !== id)
    setSaving(true)
    try {
      await updateBotConfig({ allowed_telegram_ids: updated })
      setConfig((prev) => ({ ...prev, allowed_telegram_ids: updated }))
    } finally {
      setSaving(false)
    }
  }

  async function saveLlmKey() {
    if (!llmKey.trim()) return
    setSaving(true)
    try {
      await updateBotConfig({ llm_api_key: llmKey.trim() })
      setLlmKey('')
      setShowLlmKey(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Remover a configuração do bot? O webhook será cancelado.')) return
    await deleteBotConfig()
    setConfig(null)
  }

  if (config === undefined) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>

  if (!config) {
    return <OnboardingWizard onConnected={loadConfig} />
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: config.is_active ? 'var(--bg-success-subtle, #0f2a1a)' : 'var(--bg-secondary)',
          border: `1px solid ${config.is_active ? '#16a34a' : 'var(--border-color)'}`,
          borderRadius: 10,
        }}
      >
        <div>
          <strong style={{ color: config.is_active ? '#4ade80' : 'var(--text-secondary)' }}>
            {config.is_active ? '● Bot Ativo' : '● Bot Pausado'}
          </strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            Telegram conectado ao PettoFlow
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleActive} disabled={saving}>
            {config.is_active ? 'Pausar' : 'Reativar'}
          </button>
          <button onClick={handleDisconnect} disabled={saving} style={{ color: 'var(--color-error, #ef4444)' }}>
            Desconectar
          </button>
        </div>
      </div>

      {/* Token */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>🔑 Token do Bot</strong>
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
          {config.telegram_bot_token}
        </div>
      </div>

      {/* Allowlist */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>👤 IDs Telegram Autorizados</strong>
        <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
          Envie /start ao bot para obter seu ID automaticamente
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(config.allowed_telegram_ids ?? []).map((id) => (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 20, fontFamily: 'monospace', fontSize: '0.85em' }}>
              {id}
              <button onClick={() => removeId(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ID numérico" style={{ width: 120 }} onKeyDown={(e) => e.key === 'Enter' && addTelegramId()} />
            <button onClick={addTelegramId} disabled={!newId.trim()}>+ Adicionar</button>
          </div>
        </div>
      </div>

      {/* Threshold */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9em' }}>💸 Confirmação acima de</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>R$</span>
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ width: 100, textAlign: 'right' }} />
          <button onClick={saveThreshold} disabled={saving}>Salvar</button>
          <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>— bot pedirá confirmação</span>
        </div>
      </div>

      {/* LLM Key */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '0.9em' }}>🤖 API Key LLM (linguagem natural)</strong>
            <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {config.llm_api_key ? '✅ Configurada' : 'Opcional — sem isso só slash commands funcionam'}
            </p>
          </div>
          <button onClick={() => setShowLlmKey((v) => !v)}>{showLlmKey ? 'Fechar ▲' : 'Configurar ▾'}</button>
        </div>
        {showLlmKey && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <input type="password" value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder="sk-ant-... ou sk-..." style={{ flex: 1 }} />
            <button onClick={saveLlmKey} disabled={!llmKey.trim() || saving}>Salvar</button>
          </div>
        )}
      </div>
    </div>
  )
}
