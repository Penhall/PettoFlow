import MetricCard from './MetricCard.jsx'

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  metrics = [],
  actions = null,
  className = '',
  ...props
}) {
  return (
    <section className={joinClassNames('page-header', className)} {...props}>
      <div className="page-header__main">
        <div className="page-header__copy">
          {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>

      {metrics.length ? (
        <div className="page-header__metrics" role="list" aria-label="Indicadores da pagina">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.id ?? metric.label}
              label={metric.label}
              value={metric.value}
              meta={metric.meta}
              icon={metric.icon}
              compact
              tone={metric.tone}
              role="listitem"
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
