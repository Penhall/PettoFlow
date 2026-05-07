import { useMemo, useState } from 'react'
import { useTenant } from '../../hooks/useTenant.js'
import { useMembers } from '../../hooks/useMembers.js'
import {
  canEditMembership,
  canManageMembers,
  canRemoveMembership,
  canSuspendMembership,
  getAssignableRoles,
} from '../../lib/memberPermissions.js'

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Leitor',
}

function inviteLinkFor(token) {
  if (typeof window === 'undefined') return `?invite=${token}`
  return `${window.location.origin}${window.location.pathname}?invite=${token}`
}

function formatRole(role) {
  return ROLE_LABELS[role] || role
}

export default function MembersPage() {
  const { activeTenant } = useTenant()
  const {
    members,
    invitations,
    loading,
    error,
    inviteMember,
    updateMemberRole,
    setMemberStatus,
    removeMember,
  } = useMembers()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteError, setInviteError] = useState('')
  const [actionError, setActionError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const actorRole = activeTenant?.role ?? null
  const manageable = canManageMembers(actorRole)
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole])

  async function handleInviteSubmit(event) {
    event.preventDefault()

    if (!inviteEmail.trim()) {
      setInviteError('Informe o email do convidado.')
      return
    }

    setSubmitLoading(true)
    setInviteError('')
    setActionError('')

    try {
      await inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      setInviteEmail('')
      setInviteRole('member')
    } catch (submitError) {
      setInviteError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar o convite.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (!activeTenant) {
    return null
  }

  async function handleRoleChange(memberId, nextRole) {
    setActionError('')

    try {
      await updateMemberRole(memberId, nextRole)
    } catch (memberError) {
      setActionError(memberError instanceof Error ? memberError.message : 'Não foi possível atualizar o perfil do membro.')
    }
  }

  async function handleStatusChange(memberId, nextStatus) {
    setActionError('')

    try {
      await setMemberStatus(memberId, nextStatus)
    } catch (memberError) {
      setActionError(memberError instanceof Error ? memberError.message : 'Não foi possível atualizar o status do membro.')
    }
  }

  async function handleRemoveMember(memberId) {
    setActionError('')

    try {
      await removeMember(memberId)
    } catch (memberError) {
      setActionError(memberError instanceof Error ? memberError.message : 'Não foi possível remover o membro.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2 style={{ margin: '0 0 8px' }}>Membros do espaço de trabalho</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Gerencie acesso colaborativo ao espaço de trabalho {activeTenant.name}.
        </p>
      </section>

      {!manageable && (
        <section className="empty-state">
          <h3>Acesso administrativo necessário</h3>
          <p>Apenas proprietários e admins podem gerenciar membros.</p>
        </section>
      )}

      {manageable && (
        <>
          <section style={{ padding: 20, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--surface)' }}>
            <h3 style={{ marginTop: 0 }}>Convidar novo membro</h3>
            <form onSubmit={handleInviteSubmit} style={{ display: 'grid', gap: 12 }}>
              <label htmlFor="invite-email">Email do convidado</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="colaborador@empresa.com"
              />

              <label htmlFor="invite-role">Perfil do convite</label>
              <select
                id="invite-role"
                aria-label="Perfil do convite"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>

              {inviteError && <div className="auth-error">{inviteError}</div>}

              <button type="submit" className="add-member-btn" disabled={submitLoading}>
                {submitLoading ? 'Enviando convite...' : 'Enviar convite'}
              </button>
            </form>
          </section>

          <section style={{ padding: 20, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--surface)' }}>
            <h3 style={{ marginTop: 0 }}>Convites pendentes</h3>
            {invitations.length === 0 && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Nenhum convite pendente.</p>}
            {invitations.length > 0 && (
              <div style={{ display: 'grid', gap: 12 }}>
                {invitations.map((invitation) => (
                  <article key={invitation.id} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
                    <strong>{invitation.email}</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      Perfil: {formatRole(invitation.role)} · Status: {invitation.status}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 8, wordBreak: 'break-all' }}>
                      Link do convite: {inviteLinkFor(invitation.token)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section style={{ padding: 20, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--surface)' }}>
        <h3 style={{ marginTop: 0 }}>Membros atuais</h3>
        {loading && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Carregando membros...</p>}
        {error && <div className="auth-error">{error}</div>}
        {actionError && <div className="auth-error">{actionError}</div>}
        {!loading && members.length === 0 && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Nenhum membro listado.</p>}
        {!loading && members.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {members.map((member) => {
              const canEdit = canEditMembership(actorRole, member.role, member.isCurrentUser)
              const canSuspend = canSuspendMembership(actorRole, member.role, member.isCurrentUser)
              const canRemove = canRemoveMembership(actorRole, member.role, member.isCurrentUser)

              return (
                <article key={member.id} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div>
                      <strong>{member.email}</strong>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        Perfil: {formatRole(member.role)} · Status: {member.status}
                        {member.isCurrentUser ? ' · Você' : ''}
                      </div>
                    </div>

                    {manageable && (
                      <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Perfil de {member.email}</span>
                          <select
                            aria-label={`Perfil de ${member.email}`}
                            value={member.role}
                            disabled={!canEdit}
                            onChange={(event) => handleRoleChange(member.id, event.target.value)}
                          >
                            {assignableRoles.map((role) => (
                              <option key={role} value={role}>
                                {formatRole(role)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            disabled={!canSuspend}
                            onClick={() => handleStatusChange(member.id, member.status === 'suspended' ? 'active' : 'suspended')}
                          >
                            {member.status === 'suspended' ? 'Reativar' : 'Suspender'}
                          </button>
                          <button
                            type="button"
                            className="delete-task-btn"
                            disabled={!canRemove}
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
