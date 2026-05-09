import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react'
import { MOTION_TRANSITIONS } from '../../lib/motionTokens.js'

const TOUR_STEPS = [
  {
    id: 'dashboard',
    title: 'Dashboard operacional',
    description: 'Use o dashboard para ler volume, gargalos e progresso sem transformar a rotina em um painel barulhento.',
    targetTab: 'dashboard',
    targetLabel: 'Dashboard',
  },
  {
    id: 'clientes',
    title: 'Clientes como eixo do relacionamento',
    description: 'Comece substituindo os contatos iniciais por clientes reais e conecte tarefas a esse histórico.',
    targetTab: 'clientes',
    targetLabel: 'Clientes',
  },
  {
    id: 'tarefas',
    title: 'Tarefas para a execução diária',
    description: 'O board é a superfície principal de operação. Priorize poucas colunas e títulos claros.',
    targetTab: 'tarefas',
    targetLabel: 'Tarefas',
  },
  {
    id: 'atividades',
    title: 'Atividades dão ritmo ao time',
    description: 'Registre follow-ups, reuniões e próximos passos para alimentar a timeline e o calendário.',
    targetTab: 'atividades',
    targetLabel: 'Atividades',
  },
  {
    id: 'financas',
    title: 'Finanças com leitura enxuta',
    description: 'A assinatura recorrente seeded ajuda a explicar a estrutura inicial da área financeira.',
    targetTab: 'financas',
    targetLabel: 'Finanças',
  },
  {
    id: 'tutoriais',
    title: 'Central de tutoriais sempre disponível',
    description: 'Quando a equipe precisar retomar contexto, use a área de tutoriais em vez de sobrecarregar o shell principal.',
    targetTab: 'tutoriais',
    targetLabel: 'Tutoriais',
  },
]

function clampStepIndex(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.trunc(value), TOUR_STEPS.length - 1))
}

export default function OnboardingTour({
  open = false,
  initialStepIndex = 0,
  onClose,
  onSkip,
  onComplete,
  onNavigate,
  onStepChange,
}) {
  const stepIndex = clampStepIndex(initialStepIndex)
  const step = TOUR_STEPS[stepIndex]
  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  if (!open) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        className="onboarding-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MOTION_TRANSITIONS.overlay}
      >
        <button
          type="button"
          className="onboarding-tour__backdrop"
          aria-label="Fechar tour"
          onClick={onClose}
        />

        <motion.section
          className="onboarding-tour__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-tour-title"
          initial={{ opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={MOTION_TRANSITIONS.overlay}
        >
          <div className="onboarding-tour__header">
            <div>
              <span className="onboarding-tour__eyebrow">Tour inicial</span>
              <h2 id="onboarding-tour-title">{step.title}</h2>
            </div>
            <button type="button" className="onboarding-tour__close" onClick={onClose} aria-label="Fechar tour">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <p className="onboarding-tour__description">{step.description}</p>

          <div className="onboarding-tour__meter" aria-hidden="true">
            <span
              className="onboarding-tour__meter-fill"
              style={{ '--progress-width': `${Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100)}%` }}
            />
          </div>

          <div className="onboarding-tour__footer">
            <div className="onboarding-tour__footer-meta">
              <span>Etapa {stepIndex + 1} de {TOUR_STEPS.length}</span>
              <button type="button" className="onboarding-tour__link" onClick={() => onNavigate?.(step.targetTab)}>
                <Compass size={14} strokeWidth={1.75} />
                <span>Ir para {step.targetLabel}</span>
              </button>
            </div>

            <div className="onboarding-tour__actions">
              <button type="button" className="onboarding-tour__ghost" onClick={() => onSkip?.(stepIndex)}>
                Pular tour
              </button>
              <button
                type="button"
                className="onboarding-tour__secondary"
                onClick={() => onStepChange?.(Math.max(stepIndex - 1, 0))}
                disabled={stepIndex === 0}
              >
                <ArrowLeft size={16} strokeWidth={1.75} />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                className="onboarding-tour__primary"
                onClick={() => {
                  if (isLastStep) {
                    onComplete?.()
                    return
                  }

                  onStepChange?.(stepIndex + 1)
                }}
              >
                <span>{isLastStep ? 'Concluir tour' : 'Próxima etapa'}</span>
                <ArrowRight size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
