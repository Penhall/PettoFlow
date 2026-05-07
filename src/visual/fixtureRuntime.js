export function isVisualRegressionMode() {
  return typeof window !== 'undefined' && Boolean(window.__NEXUS_VISUAL_FIXTURES__)
}

export function getVisualFixture(key, fallback = null) {
  if (typeof window === 'undefined') return fallback
  return window.__NEXUS_VISUAL_FIXTURES__?.[key] ?? fallback
}

export function filterFixtureTransactions(transactions = [], filters = {}) {
  return transactions.filter((transaction) => {
    if (filters.accountId && transaction.account_id !== filters.accountId) return false
    if (filters.categoryId && transaction.category_id !== filters.categoryId) return false
    if (filters.needsReview !== undefined && Boolean(transaction.needs_review) !== Boolean(filters.needsReview)) return false
    if (filters.cleared !== undefined && Boolean(transaction.cleared) !== Boolean(filters.cleared)) return false
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false
    if (filters.dateTo && transaction.date > filters.dateTo) return false

    if (filters.relatedTo?.type && filters.relatedTo?.id) {
      const match = Array.isArray(transaction.related_to) && transaction.related_to.some(
        (relation) => relation.type === filters.relatedTo.type && String(relation.id) === String(filters.relatedTo.id)
      )
      if (!match) return false
    }

    return true
  })
}
