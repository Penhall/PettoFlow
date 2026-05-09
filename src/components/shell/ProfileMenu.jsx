import { BookOpenText, Compass, LogOut, Palette } from 'lucide-react'
import { useState } from 'react'

export default function ProfileMenu({
  user,
  onSignOut = () => {},
  onOpenTour = () => {},
  onOpenTutorials = () => {},
}) {
  const [open, setOpen] = useState(false)

  const handleAction = (callback) => {
    callback()
    setOpen(false)
  }

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
              onClick={() => handleAction(onOpenTour)}
            >
              <Compass size={15} />
              <span>Abrir tour</span>
            </button>
            <button
              type="button"
              className="profile-menu__item"
              onClick={() => handleAction(onOpenTutorials)}
            >
              <BookOpenText size={15} />
              <span>Central de tutoriais</span>
            </button>
            <button
              type="button"
              className="profile-menu__item"
              onClick={() => handleAction(onSignOut)}
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
