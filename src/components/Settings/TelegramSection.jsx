export default function TelegramSection() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Configuracao avancada do Telegram temporariamente bloqueada</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A configuracao avancada do Telegram sera reestruturada para o modelo SaaS nas proximas fases.
        </p>
      </div>

      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Nesta fase, o NexusCRM ja exige sessao real de usuario, mas ainda nao possui tenants, memberships ou autorizacao adequada para liberar configuracoes globais do bot.
        </p>
      </div>
    </div>
  )
}
