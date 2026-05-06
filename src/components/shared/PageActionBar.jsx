function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

function ActionButton({ action, variant = 'secondary' }) {
  if (!action) {
    return null
  }

  return (
    <button
      type="button"
      className={joinClassNames(
        'page-action-bar__button',
        variant === 'primary' ? 'page-action-bar__button--primary' : ''
      )}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {action.label}
    </button>
  )
}

export default function PageActionBar({
  searchValue,
  onSearch,
  searchPlaceholder = 'Buscar nesta pagina',
  primaryAction = null,
  secondaryAction = null,
  children,
  meta = null,
  className = '',
  ...props
}) {
  const hasSearch = typeof searchValue === 'string' || typeof onSearch === 'function'

  return (
    <section className={joinClassNames('page-action-bar', className)} {...props}>
      <div className="page-action-bar__start">
        {hasSearch ? (
          <label className="page-action-bar__search">
            <span className="sr-only">Buscar nesta pagina</span>
            <svg
              className="page-action-bar__search-icon"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14.375 14.375L17.5 17.5M15.833 9.167A6.667 6.667 0 1 1 2.5 9.167a6.667 6.667 0 0 1 13.333 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="search"
              value={searchValue ?? ''}
              placeholder={searchPlaceholder}
              onChange={(event) => onSearch?.(event.target.value)}
            />
          </label>
        ) : null}

        {children ? <div className="page-action-bar__controls">{children}</div> : null}
      </div>

      <div className="page-action-bar__end">
        {meta ? <span className="page-action-bar__meta">{meta}</span> : null}
        <ActionButton action={secondaryAction} />
        <ActionButton action={primaryAction} variant="primary" />
      </div>
    </section>
  )
}
