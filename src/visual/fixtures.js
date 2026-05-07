export const VISUAL_FIXTURES = {
  columns: [
    { id: 1, name: 'A Fazer', order_index: 1 },
    { id: 2, name: 'Em Progresso', order_index: 2 },
    { id: 3, name: 'Concluido', order_index: 3 },
  ],
  team: [
    { id: 1, name: 'Ana Silva', role: 'Operacoes', status: 'Ativo', email: 'ana@nexuscrm.test', company_size: '11-50 pessoas' },
    { id: 2, name: 'Leo Costa', role: 'Vendas', status: 'Ocupado', email: 'leo@nexuscrm.test', company_size: '11-50 pessoas' },
    { id: 3, name: 'Marta Reis', role: 'Customer Success', status: 'Ausente', email: 'marta@nexuscrm.test', company_size: '11-50 pessoas' },
  ],
  clients: [
    { id: 101, name: 'Atlas Bio', industry: 'Saude', projects: 2, revenue: 'R$ 82.000', status: 'Ativo', email: 'contato@atlas.test', phone: '(11) 98888-1111', company_size: '51-200 pessoas' },
    { id: 102, name: 'Boreal Ops', industry: 'Logistica', projects: 1, revenue: 'R$ 46.000', status: 'Em negociacao', email: 'ops@boreal.test', phone: '(21) 97777-2222', company_size: '11-50 pessoas' },
    { id: 103, name: 'Ciano Studio', industry: 'Servicos', projects: 3, revenue: 'R$ 125.000', status: 'Ativo', email: 'time@ciano.test', phone: '(31) 96666-3333', company_size: '11-50 pessoas' },
  ],
  tasks: [
    { id: 201, title: 'Renovar proposta Atlas', status: 'A Fazer', priority: 'Alta', progress: 0, owner: 'Ana Silva', client_id: 101, due_date: '2026-05-09', created_at: '2026-05-02T10:00:00Z', tags: ['Renovacao'], category: 'Vendas', deal_value: 8200000 },
    { id: 202, title: 'Kickoff Boreal', status: 'Em Progresso', priority: 'Media', progress: 64, owner: 'Leo Costa', client_id: 102, due_date: '2026-05-11', created_at: '2026-05-03T09:00:00Z', tags: ['Implantacao'], category: 'Projetos', deal_value: 4600000 },
    { id: 203, title: 'Treinamento Ciano', status: 'Em Progresso', priority: 'Baixa', progress: 28, owner: 'Marta Reis', client_id: 103, due_date: '2026-05-14', created_at: '2026-05-04T15:30:00Z', tags: ['Onboarding'], category: 'CS', deal_value: 12500000 },
    { id: 204, title: 'Cobrar documentos Atlas', status: 'Concluido', priority: 'Media', progress: 100, owner: 'Ana Silva', client_id: 101, due_date: '2026-05-01', completed_at: '2026-05-05T11:00:00Z', created_at: '2026-04-29T08:30:00Z', tags: ['Financeiro'], category: 'Vendas', deal_value: 0 },
  ],
  activities: [
    { id: 301, title: 'Ligacao de alinhamento Atlas', type: 'call', status: 'pending', scheduled_at: '2026-05-10T10:00:00', related_to: [{ type: 'client', id: 101 }] },
    { id: 302, title: 'Enviar recap Boreal', type: 'email', status: 'pending', scheduled_at: '2026-05-12T15:00:00', related_to: [{ type: 'task', id: 202 }] },
    { id: 303, title: 'Check-in Ciano', type: 'meeting', status: 'done', scheduled_at: '2026-05-06T09:30:00', related_to: [{ type: 'client', id: 103 }] },
  ],
  activityTemplates: [
    { id: 401, name: 'Follow-up comercial', type: 'call', default_notes: 'Revisar proximo passo', default_assigned_to: 'Ana Silva', tags: ['Follow-up'] },
    { id: 402, name: 'Recap de reuniao', type: 'email', default_notes: 'Enviar resumo e responsaveis', default_assigned_to: 'Leo Costa', tags: ['Recap'] },
  ],
  accounts: [
    { id: 501, name: 'Conta Principal', opening_balance: 18500000, is_active: true, category: 'principal' },
    { id: 502, name: 'Reserva Operacional', opening_balance: 7200000, is_active: true, category: 'reserva' },
    { id: 503, name: 'Cartao Time', opening_balance: 1800000, is_active: true, category: 'extras' },
  ],
  payees: [
    { id: 601, name: 'Atlas Bio' },
    { id: 602, name: 'Cloud Norte' },
    { id: 603, name: 'Boreal Ops' },
  ],
  finCategoryGroups: [
    { id: 701, name: 'Receitas', is_income: true },
    { id: 702, name: 'Custos', is_income: false },
  ],
  finCategories: [
    { id: 711, group_id: 701, name: 'Mensalidade' },
    { id: 712, group_id: 702, name: 'Infraestrutura' },
    { id: 713, group_id: 702, name: 'Operacao' },
  ],
  finRules: [
    { id: 801, name: 'Cloud automatica', priority: 1, conditions: [], actions: [] },
  ],
  receivables: [
    { id: 901, task_id: 201, activity_id: null, target_account_id: 501, amount: 8200000, status: 'pending', due_date: '2026-05-15', created_at: '2026-05-05T09:00:00Z', tasks: { title: 'Renovar proposta Atlas' }, activities: null },
    { id: 902, task_id: null, activity_id: 302, target_account_id: 501, amount: 4600000, status: 'pending', due_date: '2026-05-18', created_at: '2026-05-06T09:00:00Z', tasks: null, activities: { title: 'Enviar recap Boreal' } },
  ],
  transactions: [
    { id: 1001, account_id: 501, category_id: 711, payee_id: 601, amount: 8200000, date: '2026-05-05', notes: 'Recebimento Atlas', needs_review: false, cleared: true, related_to: [{ type: 'client', id: 101 }] },
    { id: 1002, account_id: 503, category_id: 712, payee_id: 602, amount: -950000, date: '2026-05-06', notes: 'Infraestrutura cloud', needs_review: true, cleared: false, related_to: [{ type: 'client', id: 102 }] },
    { id: 1003, account_id: 502, category_id: 713, payee_id: 603, amount: -320000, date: '2026-05-07', notes: 'Despesa operacional Boreal', needs_review: false, cleared: true, related_to: [{ type: 'client', id: 102 }] },
  ],
  interactionLogs: {
    101: [
      { id: 1101, type: 'Ligacao', notes: 'Cliente pediu revisao da proposta com prazo de 12 meses.', created_at: '2026-05-05T10:15:00Z' },
      { id: 1102, type: 'Email', notes: 'Resumo enviado com novo escopo financeiro e agenda de aprovacao.', created_at: '2026-05-06T14:45:00Z' },
    ],
    102: [
      { id: 1103, type: 'Reuniao', notes: 'Kickoff validado com operacao e definicao de milestones.', created_at: '2026-05-04T16:30:00Z' },
    ],
  },
}
