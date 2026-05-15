import { describe, expect, it } from 'vitest'
import { fail, getMutationMessage, hasRawErrorLeak, normalizeError, ok } from './mutationResult.js'

describe('mutationResult', () => {
  it('normalizes backend/provider errors into safe UX copy', () => {
    const normalized = normalizeError(
      Object.assign(new Error('Supabase SQL violates constraint workspace_id_fkey'), { code: '23503' }),
      { operation: 'tasks.add' }
    )

    expect(normalized.message).toBe('Não foi possível salvar a alteração. Revise os dados e tente novamente.')
    expect(hasRawErrorLeak(normalized.message)).toBe(false)
    expect(normalized.diagnostics.rawMessage).toContain('Supabase SQL')
  })

  it('represents success and failure explicitly', () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 }, error: null, code: null })

    const result = fail(new Error('fetch failed'), { operation: 'transactions.add' })
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    expect(result.code).toBe('persistence_failed')
    expect(getMutationMessage(result)).toBe('Não foi possível salvar a alteração. Revise os dados e tente novamente.')
  })

  it('maps tenant and stale cases to actionable safe messages', () => {
    expect(fail(new Error('missing tenant'), { operation: 'accounts.add', code: 'missing_tenant' }).error.message)
      .toBe('Selecione um espaço de trabalho ativo e tente novamente.')

    expect(fail(new Error('late response'), { operation: 'tasks.update', code: 'stale_response' }).error.message)
      .toBe('A resposta chegou depois de uma mudança de espaço de trabalho. Refaça a ação no espaço atual.')
  })
})
