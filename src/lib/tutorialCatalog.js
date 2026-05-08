import { CURRENT_ONBOARDING_VERSION } from './onboardingState.js'

export const QUICK_ACTIONS = [
  { id: 'create-client', label: 'Criar cliente', targetTab: 'clientes', feature_dependency: 'clientes' },
  { id: 'import-contacts', label: 'Importar contatos', targetTab: 'clientes', feature_dependency: 'clientes' },
  { id: 'create-first-task', label: 'Criar primeira tarefa', targetTab: 'tarefas', feature_dependency: 'tarefas' },
  { id: 'use-template', label: 'Usar template', targetTab: 'atividades', feature_dependency: 'atividades' },
  { id: 'schedule-service', label: 'Agendar atendimento', targetTab: 'calendario', feature_dependency: 'calendario' },
  { id: 'open-tutorials', label: 'Abrir tutoriais', targetTab: 'tutoriais', feature_dependency: 'tutoriais' },
]

export const TUTORIAL_CATEGORIES = [
  'Primeiros passos',
  'Tarefas',
  'Atividades',
  'Clientes',
  'Financas',
  'Calendario',
  'Time',
  'Configuracoes',
]

export const TUTORIAL_CATALOG = [
  {
    id: 'getting-started.workspace',
    title: 'Organizar o espaco de trabalho',
    description: 'Entenda a estrutura inicial do workspace e como transformar exemplos em operacao real.',
    category: 'Primeiros passos',
    level: 'new',
    owner_module: 'dashboard',
    last_reviewed_at: '2026-05-07',
    deprecated: false,
    feature_dependency: 'dashboard',
    minimum_version: CURRENT_ONBOARDING_VERSION,
    targetTab: 'dashboard',
    quickActionIds: ['open-tutorials'],
  },
  {
    id: 'getting-started.clients',
    title: 'Cadastrar o primeiro cliente real',
    description: 'Substitua os registros iniciais por clientes reais e conecte tarefas ao relacionamento.',
    category: 'Clientes',
    level: 'new',
    owner_module: 'clientes',
    last_reviewed_at: '2026-05-07',
    deprecated: false,
    feature_dependency: 'clientes',
    minimum_version: CURRENT_ONBOARDING_VERSION,
    targetTab: 'clientes',
    quickActionIds: ['create-client', 'import-contacts'],
  },
  {
    id: 'getting-started.tasks',
    title: 'Criar e mover a primeira tarefa',
    description: 'Monte a primeira rotina operacional e acompanhe o progresso pelo board.',
    category: 'Tarefas',
    level: 'new',
    owner_module: 'tarefas',
    last_reviewed_at: '2026-05-07',
    deprecated: false,
    feature_dependency: 'tarefas',
    minimum_version: CURRENT_ONBOARDING_VERSION,
    targetTab: 'tarefas',
    quickActionIds: ['create-first-task'],
  },
  {
    id: 'getting-started.activities',
    title: 'Registrar a primeira atividade',
    description: 'Use atividades para dar ritmo ao relacionamento e alimentar o calendario operacional.',
    category: 'Atividades',
    level: 'learning',
    owner_module: 'atividades',
    last_reviewed_at: '2026-05-07',
    deprecated: false,
    feature_dependency: 'atividades',
    minimum_version: CURRENT_ONBOARDING_VERSION,
    targetTab: 'atividades',
    quickActionIds: ['use-template', 'schedule-service'],
  },
  {
    id: 'getting-started.finance',
    title: 'Ler a assinatura e a operacao financeira',
    description: 'Revise a conta principal, a assinatura recorrente e a logica das superficies de financas.',
    category: 'Financas',
    level: 'learning',
    owner_module: 'financas',
    last_reviewed_at: '2026-05-07',
    deprecated: false,
    feature_dependency: 'financas',
    minimum_version: CURRENT_ONBOARDING_VERSION,
    targetTab: 'financas',
    quickActionIds: ['open-tutorials'],
  },
]

export const ONBOARDING_CHECKLIST = [
  {
    id: 'review-workspace',
    title: 'Revisar a estrutura inicial',
    description: 'Entenda o shell, os dados seeded e a trilha de ativacao.',
    tutorialId: 'getting-started.workspace',
    ctaTarget: 'dashboard',
    quickActionId: 'open-tutorials',
  },
  {
    id: 'create-first-client',
    title: 'Cadastrar o primeiro cliente real',
    description: 'Troque os contatos iniciais por um cliente real da operacao.',
    tutorialId: 'getting-started.clients',
    ctaTarget: 'clientes',
    quickActionId: 'create-client',
  },
  {
    id: 'create-first-task',
    title: 'Criar a primeira tarefa real',
    description: 'Abra a rotina do time com uma tarefa conectada a um cliente ou fluxo real.',
    tutorialId: 'getting-started.tasks',
    ctaTarget: 'tarefas',
    quickActionId: 'create-first-task',
  },
  {
    id: 'log-first-activity',
    title: 'Registrar a primeira atividade',
    description: 'Adicione uma atividade para alimentar o historico e o calendario.',
    tutorialId: 'getting-started.activities',
    ctaTarget: 'atividades',
    quickActionId: 'use-template',
  },
  {
    id: 'review-finance',
    title: 'Revisar a assinatura recorrente',
    description: 'Confira a conta principal e a leitura inicial da area financeira.',
    tutorialId: 'getting-started.finance',
    ctaTarget: 'financas',
    quickActionId: 'open-tutorials',
  },
]

export function getTutorialById(tutorialId) {
  return TUTORIAL_CATALOG.find((tutorial) => tutorial.id === tutorialId) ?? null
}

export function getChecklistItemById(itemId) {
  return ONBOARDING_CHECKLIST.find((item) => item.id === itemId) ?? null
}

export function getQuickActionById(actionId) {
  return QUICK_ACTIONS.find((action) => action.id === actionId) ?? null
}

export function getTutorialsByCategory(category) {
  return TUTORIAL_CATALOG.filter((tutorial) => tutorial.category === category)
}

export function getTutorialsForTab(targetTab) {
  return TUTORIAL_CATALOG.filter((tutorial) => tutorial.targetTab === targetTab)
}
