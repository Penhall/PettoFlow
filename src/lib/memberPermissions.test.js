import { describe, expect, it } from 'vitest'
import {
  canManageMembers,
  canEditMembership,
  canRemoveMembership,
  canSuspendMembership,
  getAssignableRoles,
} from './memberPermissions.js'

describe('memberPermissions', () => {
  it('permite gestao de membros apenas para owner e admin', () => {
    expect(canManageMembers('owner')).toBe(true)
    expect(canManageMembers('admin')).toBe(true)
    expect(canManageMembers('member')).toBe(false)
    expect(canManageMembers('viewer')).toBe(false)
  })

  it('bloqueia autoelevacao e edicao de owners na UI', () => {
    expect(canEditMembership('owner', 'owner', false)).toBe(false)
    expect(canEditMembership('owner', 'admin', true)).toBe(false)
    expect(canEditMembership('admin', 'member', true)).toBe(false)
  })

  it('permite owner editar admin/member/viewer e admin editar member/viewer', () => {
    expect(canEditMembership('owner', 'admin', false)).toBe(true)
    expect(canEditMembership('owner', 'member', false)).toBe(true)
    expect(canEditMembership('admin', 'member', false)).toBe(true)
    expect(canEditMembership('admin', 'viewer', false)).toBe(true)
    expect(canEditMembership('admin', 'admin', false)).toBe(false)
  })

  it('usa a mesma matriz basica para remocao e suspensao', () => {
    expect(canRemoveMembership('owner', 'admin', false)).toBe(true)
    expect(canRemoveMembership('admin', 'viewer', false)).toBe(true)
    expect(canRemoveMembership('admin', 'admin', false)).toBe(false)
    expect(canSuspendMembership('owner', 'member', false)).toBe(true)
    expect(canSuspendMembership('member', 'viewer', false)).toBe(false)
  })

  it('nao oferece role owner como atribuivel na interface', () => {
    expect(getAssignableRoles('owner')).toEqual(['admin', 'member', 'viewer'])
    expect(getAssignableRoles('admin')).toEqual(['admin', 'member', 'viewer'])
    expect(getAssignableRoles('member')).toEqual([])
  })
})
