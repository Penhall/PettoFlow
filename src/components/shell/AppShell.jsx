function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function AppShell({ sidebar, topbar, children, sidebarCollapsed = false }) {
  return (
    <div className={joinClassNames('app-shell', sidebarCollapsed ? 'app-shell--collapsed' : '')}>
      <aside className="app-shell__sidebar">{sidebar}</aside>
      <div className="app-shell__workspace">
        <header className="app-shell__topbar">{topbar}</header>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
