import { useEffect, useState, useCallback } from 'react'
import { getBotConfig, updateBotConfig, deleteBotConfig } from '../../lib/botConfig.js'
import { countTelegramIntegrationFailure } from '../../lib/diagnostics.js'
import { normalizeError } from '../../lib/mutationResult.js'
import { useTenant } from '../../hooks/useTenant.js'
import { ERROR_TEXT, LOADING_TEXT, SETTINGS_TEXT } from '../../content/uxText.js'
import OnboardingWizard from './OnboardingWizard.jsx'

function ConfigStatus({ tenantId, config, onDisconnect }) {
  const [isActive, setIsActive] = useState(config?.is_active ?? true)
  const [llmKey, setLlmKey] = useState('')
  const [llmProvider, setLlmProvider] = useState(config?.llm_provider ?? 'anthropic')
  const [threshold, setThreshold] = useState(String(config?.confirmation_threshold ?? 500))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const ids = config?.allowed_telegram_ids ?? []

  async function handleToggleActive() {
    setSaving(true)
    setError('')
    try {
      const next = !isActive
      await updateBotConfig(tenantId, { is_active: next })
      setIsActive(next)
      setSuccess(next ? 'Bot ativado.' : 'Bot pausado.')
    } catch (err) {
      setError(normalizeError(err, { operation: 'telegram.toggle' }).message)
      countTelegramIntegrationFailure()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveLlm() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateBotConfig(tenantId, {
        llm_api_key: llmKey.trim() || null,
        llm_provider: llmProvider,
      })
      setSuccess('LLM atualizado.')
      setLlmKey('')
    } catch (err) {
      setError(normalizeError(err, { operation: 'telegram.llm' }).message)
      countTelegramIntegrationFailure()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveThreshold() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateBotConfig(tenantId, { confirmation_threshold: Number(threshold) })
      setSuccess('Limiar de confirmacao atualizado.')
    } catch (err) {
      setError(normalizeError(err, { operation: 'telegram.threshold' }).message)
      countTelegramIntegrationFailure()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 600 }}>
      {success && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(220, 38, 38, 0.12)', color: '#fecaca' }}>
          {error}
        </div>
      )}

      {/* Status card */}
      <div style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Status do Bot</strong>
          <span style={{ color: isActive ? '#16a34a' : '#a16207', fontSize: '0.85em' }}>
            {isActive ? '🟢 Ativo' : '🟡 Pausado'}
          </span>
        </div>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          {ids.length} {ids.length === 1 ? 'usuário autorizado' : 'usuários autorizados'}
        </p>
        <button
          type="button"
          className="icon-btn"
          onClick={handleToggleActive}
          disabled={saving}
        >
          {isActive ? '⏸ Pausar bot' : '▶ Ativar bot'}
        </button>
      </div>

      {/* Confirmation threshold */}
      <div style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Limiar de Confirmacao</strong>
        <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.85em' }}>
          Transacoes acima deste valor exigem confirmacao &quot;SIM&quot; no Telegram.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>R$</span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            min="0"
            step="10"
            style={{ width: 120 }}
          />
          <button type="button" className="icon-btn" onClick={handleSaveThreshold} disabled={saving}>
            Salvar
          </button>
        </div>
      </div>

      {/* LLM config */}
      <div style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>
          {config?.llm_provider ? 'LLM Configurado' : 'LLM (opcional)'}
        </strong>
        <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.85em' }}>
          {config?.llm_provider
            ? 'Provedor atual: ' + (config.llm_provider === 'anthropic' ? 'Anthropic Claude' : 'Google Gemini')
            : 'Sem LLM — apenas comandos slash funcionam.'}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="anthropic">Anthropic Claude</option>
            <option value="google">Google Gemini</option>
          </select>
          <input
            type="password"
            value={llmKey}
            onChange={(e) => setLlmKey(e.target.value)}
            placeholder={config?.llm_provider ? 'Deixe vazio para manter o atual' : 'sk-ant-... ou chave Gemini'}
            style={{ flex: 1 }}
          />
          <button type="button" className="icon-btn" onClick={handleSaveLlm} disabled={saving || (!llmKey.trim() && config?.llm_provider)}>
            {config?.llm_provider ? 'Alterar chave' : 'Configurar LLM'}
          </button>
        </div>
      </div>

      {/* Authorized IDs */}
      <div style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>IDs Telegram Autorizados</strong>
        {ids.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85em' }}>
            Nenhum usuario autorizado. Envie <code>/start</code> ao bot para se registrar.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            {ids.map((id) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <code>{id}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disconnect */}
      <div style={{ padding: 16, border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: 12 }}>
        <strong style={{ display: 'block', marginBottom: 8, color: '#fecaca' }}>Desconectar Bot</strong>
        <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.85em' }}>
          Remove a configuracao, apaga o webhook e desativa o bot.
        </p>
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Tem certeza? Esta acao remove o bot permanentemente.')) return
            try {
              await deleteBotConfig(tenantId)
              onDisconnect()
            } catch (err) {
              setError(normalizeError(err, { operation: 'telegram.disconnect' }).message)
              countTelegramIntegrationFailure()
            }
          }}
          style={{ color: '#fecaca', border: '1px solid rgba(220, 38, 38, 0.4)' }}
        >
          Desconectar
        </button>
      </div>
    </div>
  )
}

export default function TelegramSection() {
  const { activeTenantId } = useTenant()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!activeTenantId) {
        setConfig(null)
        return
      }
      const data = await getBotConfig(activeTenantId)
      setConfig(data?.config ?? null)
    } catch (err) {
      if (err.message?.includes('403') || err.message?.includes('401')) {
        setConfig(null)
      } else {
        setError(normalizeError(err, { operation: 'telegram.load' }).message || ERROR_TEXT.telegramConfig)
        countTelegramIntegrationFailure()
      }
    } finally {
      setLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  async function handleConnected() {
    await loadConfig()
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>{LOADING_TEXT.telegramConfig}</div>
  }

  if (error) {
    return <div style={{ color: '#fecaca' }}>{error}</div>
  }

  if (!activeTenantId) {
    return <div style={{ color: 'var(--text-secondary)' }}>{SETTINGS_TEXT.noActiveTelegramWorkspace}</div>
  }

  if (!config) {
    return (
      <div>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          Conecte seu bot do Telegram para gerenciar tarefas, atividades e finanças diretamente pelo Telegram.
        </p>
        <OnboardingWizard tenantId={activeTenantId} onConnected={handleConnected} />
      </div>
    )
  }

  return (
    <div>
      <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
        Bot conectado. Gerencie as configurações abaixo.
        {' '}<a href="#" onClick={(e) => { e.preventDefault(); loadConfig() }} style={{ color: 'var(--primary)' }}>Atualizar</a>
      </p>
      <ConfigStatus tenantId={activeTenantId} config={config} onRefresh={loadConfig} onDisconnect={() => setConfig(null)} />
    </div>
  )
}
