import { LogOut, Palette } from 'lucide-react'
import { useState } from 'react'

export default function ProfileMenu({ user, onSignOut = () => {} }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="profile-menu__avatar">
          {(user?.email?.[0] || 'N').toUpperCase()}
        </span>
        <span className="profile-menu__meta">
          <strong>{user?.email || 'Usuário NexusCRM'}</strong>
          <small>Perfil</small>
        </span>
      </button>

      {open ? (
        <div className="profile-menu__content" role="menu">
          <div className="profile-menu__section">
            <span className="profile-menu__section-title">Conta</span>
            <div className="profile-menu__identity">
              <Palette size={15} />
              <span>{user?.email || 'Usuário autenticado'}</span>
            </div>
            <button
              type="button"
              className="profile-menu__item"
              onClick={onSignOut}
            >
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
