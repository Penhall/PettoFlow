import { Monitor, MoonStar, Palette, SunMedium } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../context/ThemeContext.jsx'

const THEME_ICONS = {
  light: SunMedium,
  dark: MoonStar,
  classic: Monitor,
  twenty: Palette,
}

export default function ThemeSwitcher() {
  const { theme, themes, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const currentTheme = themes.find((item) => item.id === theme) ?? themes[0]
  const CurrentIcon = THEME_ICONS[currentTheme?.id] ?? Palette

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div className="theme-switcher" ref={containerRef}>
      <button
        type="button"
        className="theme-switcher__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir seletor de tema"
        onClick={() => setOpen((current) => !current)}
      >
        <CurrentIcon size={15} />
        <span>{currentTheme?.name ?? 'Tema'}</span>
      </button>

      {open ? (
        <div className="theme-switcher__content" role="menu" aria-label="Temas disponíveis">
          {themes.map((item) => {
            const Icon = THEME_ICONS[item.id] ?? Palette
            return (
              <button
                key={item.id}
                type="button"
                className={`theme-switcher__item ${theme === item.id ? 'is-active' : ''}`}
                role="menuitemradio"
                aria-checked={theme === item.id}
                onClick={() => {
                  setTheme(item.id)
                  setOpen(false)
                }}
              >
                <Icon size={15} />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
