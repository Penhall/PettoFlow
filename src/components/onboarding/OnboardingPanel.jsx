import { ArrowRight, BookOpenText, CheckCircle2, Compass, X } from 'lucide-react'
import SurfaceCard from '../shared/SurfaceCard.jsx'

export default function OnboardingPanel({
  progress = 0,
  total = 0,
  items = [],
  onOpenTutorials,
  onOpenTour,
  onSelectItem,
  onDismiss,
}) {
  const pendingItems = items.filter((item) => !item.completed)
  const completionRatio = total > 0 ? Math.max(0, Math.min(progress / total, 1)) : 0

  return (
    <SurfaceCard className="onboarding-panel">
      <div className="onboarding-panel__header">
        <div className="onboarding-panel__intro">
          <span className="onboarding-panel__eyebrow">Primeiros passos</span>
          <h2>{progress} de {total} etapas concluídas</h2>
          <p>
            Configure o espaço com calma. Os exemplos iniciais podem ser editados ou apagados desde o primeiro minuto.
          </p>
        </div>

        <div className="onboarding-panel__header-actions">
          {onDismiss ? (
            <button
              type="button"
              className="onboarding-panel__ghost-button"
              onClick={onDismiss}
              aria-label="Dispensar painel de onboarding"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="onboarding-panel__progress" aria-hidden="true">
        <span className="onboarding-panel__progress-track">
          <span
            className="onboarding-panel__progress-fill"
            style={{ '--progress-width': `${Math.round(completionRatio * 100)}%` }}
          />
        </span>
      </div>

      <div className="onboarding-panel__body">
        <div className="onboarding-panel__list" role="list" aria-label="Checklist inicial">
          {pendingItems.length ? pendingItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              className="onboarding-panel__item"
              onClick={() => onSelectItem?.(item)}
              role="listitem"
            >
              <span className="onboarding-panel__item-icon" aria-hidden="true">
                <CheckCircle2 size={16} strokeWidth={1.75} />
              </span>
              <span className="onboarding-panel__item-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </button>
          )) : (
            <div className="onboarding-panel__complete" role="listitem">
              <CheckCircle2 size={18} strokeWidth={1.75} />
              <div>
                <strong>Onboarding concluído</strong>
                <span>O workspace já tem base suficiente para operação diária.</span>
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-panel__actions">
          <button type="button" className="onboarding-panel__action" onClick={onOpenTutorials}>
            <BookOpenText size={16} strokeWidth={1.75} />
            <span>Abrir tutoriais</span>
          </button>
          <button type="button" className="onboarding-panel__action onboarding-panel__action--primary" onClick={onOpenTour}>
            <Compass size={16} strokeWidth={1.75} />
            <span>Fazer tour rápido</span>
          </button>
        </div>
      </div>
    </SurfaceCard>
  )
}
