export default function TelegramSection() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Configuração avançada do Telegram temporariamente bloqueada</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A configuração avançada do Telegram será reestruturada para o modelo SaaS nas próximas fases.
        </p>
      </div>

      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Nesta fase, o NexusCRM já exige sessão real de usuário, mas ainda não possui espaços de trabalho, memberships ou autorização adequada para liberar configurações globais do bot.
        </p>
      </div>
    </div>
  )
}
