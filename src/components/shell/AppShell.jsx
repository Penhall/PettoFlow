export default function AppShell({ sidebar, topbar, children }) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">{sidebar}</aside>
      <div className="app-shell__workspace">
        <header className="app-shell__topbar">{topbar}</header>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
