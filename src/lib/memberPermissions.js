export function canManageMembers(role) {
  return role === 'owner' || role === 'admin'
}

export function getAssignableRoles(actorRole) {
  if (!canManageMembers(actorRole)) return []
  return ['admin', 'member', 'viewer']
}

export function canEditMembership(actorRole, targetRole, isSelf) {
  if (!canManageMembers(actorRole) || isSelf) return false
  if (targetRole === 'owner') return false
  if (actorRole === 'owner') return ['admin', 'member', 'viewer'].includes(targetRole)
  return ['member', 'viewer'].includes(targetRole)
}

export function canRemoveMembership(actorRole, targetRole, isSelf) {
  return canEditMembership(actorRole, targetRole, isSelf)
}

export function canSuspendMembership(actorRole, targetRole, isSelf) {
  return canEditMembership(actorRole, targetRole, isSelf)
}
