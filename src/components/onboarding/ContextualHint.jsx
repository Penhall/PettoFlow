import { Info, X } from 'lucide-react'
import SurfaceCard from '../shared/SurfaceCard.jsx'

export default function ContextualHint({
  title,
  description,
  actionLabel = null,
  onAction = null,
  onDismiss = null,
}) {
  return (
    <SurfaceCard className="contextual-hint" padded={false} tone="muted">
      <div className="contextual-hint__icon" aria-hidden="true">
        <Info size={16} strokeWidth={1.75} />
      </div>

      <div className="contextual-hint__copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <div className="contextual-hint__actions">
        {actionLabel ? (
          <button type="button" className="contextual-hint__action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="contextual-hint__dismiss"
            onClick={onDismiss}
            aria-label="Dispensar dica"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  )
}
