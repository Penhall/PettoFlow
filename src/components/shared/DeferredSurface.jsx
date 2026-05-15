import { LOADING_TEXT } from '../../content/uxText.js'

export default function DeferredSurface({ label = LOADING_TEXT.area }) {
  return (
    <div className="deferred-surface" role="status" aria-live="polite">
      <span className="deferred-surface__label">{label}</span>
    </div>
  )
}
