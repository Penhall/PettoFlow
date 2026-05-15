export const PRODUCT = {
  name: 'NexusCRM',
  workspace: 'espaço de trabalho',
  workspacePlural: 'espaços de trabalho',
  adminArea: 'administração da plataforma',
}

export const ACTION_TEXT = {
  retry: 'Tentar novamente',
  reloadPage: 'Recarregar página',
  refresh: 'Atualizar',
  refreshPanel: 'Atualizar painel',
  backToWorkspace: 'Voltar ao espaço de trabalho',
  createWorkspace: 'Criar espaço de trabalho',
  creatingWorkspace: 'Criando espaço de trabalho...',
}

export const LOADING_TEXT = {
  app: `Carregando ${PRODUCT.name}...`,
  workspaceList: `Carregando ${PRODUCT.workspacePlural} do ${PRODUCT.name}...`,
  area: 'Carregando área...',
  settingsSection: 'Carregando seção de configurações...',
  commands: 'Carregando comandos...',
  telegramConfig: 'Carregando configuração do bot...',
  adminPanel: 'Carregando painel administrativo...',
  adminProfile: 'Carregando perfil administrativo.',
  tabs: {
    dashboard: 'Carregando dashboard...',
    tarefas: 'Carregando tarefas...',
    atividades: 'Carregando atividades...',
    financas: 'Carregando finanças...',
    time: 'Carregando time...',
    clientes: 'Carregando clientes...',
    arquivo: 'Carregando arquivo...',
    calendario: 'Carregando calendário...',
    tutoriais: 'Carregando tutoriais...',
    settings: 'Carregando configurações...',
    'admin-dashboard': 'Carregando dashboard administrativo...',
    'admin-tenants': 'Carregando espaços de trabalho...',
    'admin-audit': 'Carregando auditoria...',
    'admin-plans': 'Carregando planos...',
  },
}

export const SHELL_TEXT = {
  search: {
    member: 'Buscar membro ou função',
    tutorial: 'Buscar tutorial ou módulo',
    client: 'Buscar cliente ou segmento',
    command: 'Ir para cliente, tarefa ou atividade',
    default: 'Pesquisar',
    palette: 'Buscar cliente, tarefa ou atividade...',
  },
  tabErrorLabels: {
    dashboard: 'o dashboard',
    tarefas: 'a área de tarefas',
    atividades: 'a área de atividades',
    financas: 'a área de finanças',
    time: 'a área de time',
    clientes: 'a área de clientes',
    arquivo: 'a área de arquivo',
    calendario: 'a área de calendário',
    tutoriais: 'a central de tutoriais',
    settings: 'a área de configurações',
    'admin-dashboard': 'o dashboard administrativo',
    'admin-tenants': 'a lista de espaços de trabalho',
    'admin-audit': 'a auditoria',
    'admin-plans': 'a gestão de planos',
  },
}

export const EMPTY_STATE_TEXT = {
  workspaceBootstrap: {
    title: 'Não foi possível carregar o espaço de trabalho',
    description: 'A inicialização do espaço de trabalho falhou antes da área operacional ficar pronta.',
    detail: 'Tente novamente para recarregar o espaço de trabalho ativo.',
  },
  noActiveWorkspace: 'Selecione um espaço de trabalho ativo para continuar.',
  noCommands: 'Nenhum comando encontrado. Use o botão abaixo para instalar os comandos padrão.',
  noCustomCommands: 'Nenhum comando personalizado ainda.',
  noWorkspaces: 'Nenhum espaço de trabalho encontrado.',
}

export const ERROR_TEXT = {
  generic: 'Não foi possível concluir a operação. Tente novamente.',
  authSignOut: 'Não foi possível encerrar a sessão agora. Tente novamente.',
  missingWorkspace: 'Selecione um espaço de trabalho ativo e tente novamente.',
  persistenceFailed: 'Não foi possível salvar a alteração. Revise os dados e tente novamente.',
  staleResponse: 'A resposta chegou depois de uma mudança de espaço de trabalho. Refaça a ação no espaço atual.',
  cancelled: 'A ação foi interrompida. Tente novamente.',
  notFound: 'O registro não está mais disponível. Atualize a tela e tente novamente.',
  validationFailed: 'Revise os dados informados e tente novamente.',
  loadWorkspaceList: 'Não foi possível carregar os espaços de trabalho. Tente novamente.',
  createWorkspace: 'Não foi possível criar o espaço de trabalho. Revise os dados e tente novamente.',
  adminPanel: 'Não foi possível carregar o painel administrativo. Tente novamente.',
  commands: 'Não foi possível carregar os comandos. Tente novamente.',
  telegramConfig: 'Não foi possível carregar a configuração do Telegram. Tente novamente.',
  viewRender: 'A interface desta área encontrou um erro inesperado durante a renderização.',
  viewRetry: 'Tente abrir a área novamente. Se o problema persistir, recarregue a página.',
  chunkTitle: (areaLabel) => `Os módulos de ${areaLabel} ficaram desatualizados`,
  chunkDescription: 'O navegador manteve uma versão antiga do app enquanto esta área já foi publicada em um novo pacote.',
  chunkDetail: 'Recarregue a página para buscar os módulos atualizados. Isso costuma acontecer logo após uma publicação.',
  rootTitle: 'Algo deu errado',
  rootDescription: 'A interface encontrou um erro inesperado e não conseguiu se recuperar automaticamente.',
  rootExhausted: 'O erro persiste após múltiplas tentativas. Recarregue a página para continuar.',
}

export const SETTINGS_TEXT = {
  tabs: [
    { id: 'workspace', label: 'Espaço de trabalho' },
    { id: 'members', label: 'Membros' },
    { id: 'billing', label: 'Faturamento' },
    { id: 'security', label: 'Segurança' },
    { id: 'audit', label: 'Auditoria' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'commands', label: 'Comandos' },
  ],
  header: {
    eyebrow: 'Espaço de trabalho',
    title: 'Configurações',
    subtitle: 'Gerencie membros, integrações, auditoria e preferências do espaço de trabalho.',
  },
  noActiveCommandsWorkspace: 'Selecione um espaço de trabalho ativo para gerenciar comandos.',
  noActiveTelegramWorkspace: 'Selecione um espaço de trabalho ativo para configurar o Telegram.',
}

export const ADMIN_TEXT = {
  title: 'Operação global da plataforma',
  eyebrow: `Painel administrativo ${PRODUCT.name}`,
  deniedTitle: 'Acesso administrativo negado',
  deniedDescription: `Esta área interna do ${PRODUCT.name} exige permissão administrativa global.`,
  workspaceUsageTitle: 'Espaços de trabalho e uso',
  workspaceMetric: 'Espaços',
}

export const ERROR_MESSAGE_BY_CODE = {
  missing_tenant: ERROR_TEXT.missingWorkspace,
  persistence_failed: ERROR_TEXT.persistenceFailed,
  stale_response: ERROR_TEXT.staleResponse,
  cancelled: ERROR_TEXT.cancelled,
  not_found: ERROR_TEXT.notFound,
  validation_failed: ERROR_TEXT.validationFailed,
}
