import SurfaceCard from './SurfaceCard.jsx'

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  detail,
  action,
  className = '',
  ...props
}) {
  return (
    <SurfaceCard className={joinClassNames('empty-state', className)} {...props}>
      {Icon ? (
        <div className="empty-state__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="empty-state__copy">
        <h3 className="empty-state__title">{title}</h3>
        {description ? <p className="empty-state__description">{description}</p> : null}
        {detail ? <p className="empty-state__detail">{detail}</p> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </SurfaceCard>
  )
}
