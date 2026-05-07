export default function DeferredSurface({ label = 'Carregando area...' }) {
  return (
    <div className="deferred-surface" role="status" aria-live="polite">
      <span className="deferred-surface__label">{label}</span>
    </div>
  )
}
