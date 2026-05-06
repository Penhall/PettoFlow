function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function PageTabs({
  items = [],
  activeId,
  onChange,
  ariaLabel = 'Views',
  className = '',
  ...props
}) {
  return (
    <div className={joinClassNames('page-tabs', className)} {...props}>
      <div className="page-tabs__scroller" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive = item.id === activeId

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={joinClassNames('page-tabs__tab', isActive ? 'is-active' : '')}
              onClick={() => onChange?.(item.id)}
              disabled={item.disabled}
            >
              <span>{item.label}</span>
              {item.count !== undefined ? (
                <span className="page-tabs__count" aria-hidden="true">
                  {item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
