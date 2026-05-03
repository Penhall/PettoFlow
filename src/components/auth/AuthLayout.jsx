export default function AuthLayout({ eyebrow = 'NexusCRM', title, description, children, footer }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(180deg, var(--bg-main) 0%, var(--bg-secondary) 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          padding: 28,
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg, var(--bg-sidebar))',
          boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.12))',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
          {eyebrow}
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: '2rem', lineHeight: 1.1 }}>
          {title}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>

        <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          {children}
        </div>

        {footer ? (
          <div style={{ marginTop: 18, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
