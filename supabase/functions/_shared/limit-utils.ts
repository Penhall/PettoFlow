export type PlanLimits = {
  max_users: number | null
  max_clients: number | null
  max_tasks: number | null
  max_activities: number | null
  max_transactions: number | null
}

export function normalizePlanLimits(raw: Record<string, unknown> | null | undefined): PlanLimits {
  function toNullableInt(value: unknown) {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  return {
    max_users: toNullableInt(raw?.max_users),
    max_clients: toNullableInt(raw?.max_clients),
    max_tasks: toNullableInt(raw?.max_tasks),
    max_activities: toNullableInt(raw?.max_activities),
    max_transactions: toNullableInt(raw?.max_transactions),
  }
}

export function resolveLimitExceededMessage(metric: string) {
  switch (metric) {
    case 'max_users':
      return 'Limite de usuarios do plano atingido para este workspace.'
    case 'max_clients':
      return 'Limite de clientes do plano atingido para este workspace.'
    case 'max_tasks':
      return 'Limite de tarefas do plano atingido para este workspace.'
    case 'max_activities':
      return 'Limite de atividades do plano atingido para este workspace.'
    case 'max_transactions':
      return 'Limite de transacoes do plano atingido para este workspace.'
    default:
      return 'Limite do plano atingido para este workspace.'
  }
}
