export default function CommandsSection() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Comandos administrativos do Telegram temporariamente bloqueados</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A configuração avançada do Telegram será reestruturada para o modelo SaaS nas próximas fases.
        </p>
      </div>

      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Os comandos do bot continuam fora do fluxo principal até que o NexusCRM tenha espaços de trabalho, memberships e autorização granular para operações sensíveis.
        </p>
      </div>
    </div>
  )
}
