// src/lib/rulesEngine.js
// Motor de regras puro — sem hooks, sem efeitos colaterais, nunca lança exceção.
// O caller é responsável por ordenar `rules` por (priority ASC, id ASC) antes de passar.
// Aplica TODAS as regras cujas condições batem (apply-all, não first-match-wins).

export function evaluateCondition(condition, transaction) {
  try {
    const { field, op, value } = condition
    const fieldValue = transaction[field]
    switch (op) {
      case 'contains':
        return String(fieldValue ?? '').toLowerCase().includes(String(value).toLowerCase())
      case 'not_contains':
        return !String(fieldValue ?? '').toLowerCase().includes(String(value).toLowerCase())
      case 'is':
        return String(fieldValue) === String(value)
      case 'is_not':
        return String(fieldValue) !== String(value)
      case 'greater_than':
        return Number(fieldValue) > Number(value)
      case 'less_than':
        return Number(fieldValue) < Number(value)
      case 'starts_with':
        return String(fieldValue ?? '').toLowerCase().startsWith(String(value).toLowerCase())
      case 'matches_regexp':
        return new RegExp(value).test(String(fieldValue ?? ''))
      default:
        return false
    }
  } catch {
    return false
  }
}

// Retorna true somente se TODAS as condições do array forem satisfeitas.
// Array vazio retorna false (regra sem condições não bate).
export function allConditionsMatch(conditions, transaction) {
  if (!conditions || conditions.length === 0) return false
  return conditions.every(c => evaluateCondition(c, transaction))
}

// Aplica as ações em cópia da transação; retorna cópia modificada.
export function applyActions(actions, transaction) {
  const result = { ...transaction }
  for (const action of (actions || [])) {
    switch (action.type) {
      case 'set_category': result.category_id = action.value;          break
      case 'rename_payee': result.payee_name  = action.value;          break
      case 'set_notes':    result.notes       = action.value;          break
      case 'set_cleared':  result.cleared     = Boolean(action.value); break
      case 'flag_review':  result.needs_review = Boolean(action.value); break
    }
  }
  return result
}

// Ponto de entrada principal.
// rules deve estar pré-ordenada pelo caller (priority ASC, id ASC).
// Itera sobre todas as regras ativas; aplica as que batem.
export function runRulesEngine(transaction, rules) {
  const activeRules = (rules || []).filter(r => r.is_active)
  let enriched = { ...transaction }
  let ruleMatched = false

  for (const rule of activeRules) {
    if (allConditionsMatch(rule.conditions, enriched)) {
      enriched = applyActions(rule.actions, enriched)
      ruleMatched = true
    }
  }

  return { enriched, ruleMatched }
}
