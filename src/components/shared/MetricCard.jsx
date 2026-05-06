function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function MetricCard({
  label,
  value,
  meta,
  icon: Icon,
  compact = false,
  tone = 'default',
  className = '',
  ...props
}) {
  return (
    <article
      className={joinClassNames(
        'metric-card',
        compact ? 'metric-card--compact' : '',
        tone !== 'default' ? `metric-card--${tone}` : '',
        className
      )}
      {...props}
    >
      <div className="metric-card__eyebrow">
        <span className="metric-card__label">{label}</span>
        {Icon ? (
          <span className="metric-card__icon" aria-hidden="true">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <strong className="metric-card__value">{value}</strong>
      {meta ? <span className="metric-card__meta">{meta}</span> : null}
    </article>
  )
}
