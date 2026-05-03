export default function CommandsSection() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Comandos administrativos do Telegram temporariamente bloqueados</strong>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A configuracao avancada do Telegram sera reestruturada para o modelo SaaS nas proximas fases.
        </p>
      </div>

      <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Os comandos do bot continuam fora do fluxo principal ate que NexusCRM tenha tenants, memberships e autorizacao granular para operacoes sensiveis.
        </p>
      </div>
    </div>
  )
}
