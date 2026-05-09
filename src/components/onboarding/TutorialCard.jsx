import { ArrowRight, CheckCircle2 } from 'lucide-react'
import SurfaceCard from '../shared/SurfaceCard.jsx'

export default function TutorialCard({
  tutorial,
  quickActions = [],
  completed = false,
  onOpen,
  onQuickAction,
}) {
  return (
    <SurfaceCard as="article" className="tutorial-card">
      <div className="tutorial-card__header">
        <div>
          <span className="tutorial-card__category">{tutorial.category}</span>
          <h2>{tutorial.title}</h2>
        </div>
        {completed ? (
          <span className="tutorial-card__badge tutorial-card__badge--done">
            <CheckCircle2 size={14} strokeWidth={1.75} />
            <span>Concluído</span>
          </span>
        ) : (
          <span className="tutorial-card__badge">{tutorial.level}</span>
        )}
      </div>

      <p className="tutorial-card__description">{tutorial.description}</p>

      <div className="tutorial-card__meta">
        <span>Módulo: {tutorial.owner_module}</span>
        <span>Versão mínima: {tutorial.minimum_version}</span>
      </div>

      {quickActions.length ? (
        <div className="tutorial-card__quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="tutorial-card__quick-action"
              onClick={() => onQuickAction?.(action, tutorial)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="tutorial-card__footer">
        <button type="button" className="tutorial-card__open" onClick={() => onOpen?.(tutorial)}>
          <span>Abrir área guiada</span>
          <ArrowRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </SurfaceCard>
  )
}
