import { useMemo, useState } from 'react'
import { useTenant } from '../../hooks/useTenant.js'
import { useMembers } from '../../hooks/useMembers.js'
import { usePlanFeature } from '../../hooks/usePlanFeature.js'
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

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function MembersPage() {
  const { activeTenant } = useTenant()
  const {
    members,
    invitations,
    loading,
    error,
    deleteInvitation,
    inviteMember,
    updateMemberRole,
    setMemberStatus,
    removeMember,
  } = useMembers()
  const { isEnabled: multiUser, loading: planLoading } = usePlanFeature('multi_user')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(null)
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
    setInviteSuccess(null)
    setActionError('')

    try {
      const result = await inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      const delivery = result?.delivery

      if (delivery?.sent) {
        setInviteSuccess(`Convite enviado com sucesso para ${inviteEmail.trim()}.`)
      } else if (delivery?.skipped) {
        setInviteSuccess(
          `Convite registrado para ${inviteEmail.trim()}. O email não foi entregue automaticamente — compartilhe o link manualmente.`
        )
      } else {
        setInviteSuccess(`Convite registrado para ${inviteEmail.trim()}.`)
      }

      setInviteEmail('')
      setInviteRole('member')
    } catch (submitError) {
      setInviteError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar o convite.')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function copyInviteLink(token) {
    const link = inviteLinkFor(token)
    try {
      await navigator.clipboard.writeText(link)
      setInviteSuccess('Link do convite copiado!')
    } catch {
      setInviteSuccess(`Link: ${link}`)
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

      {/* Upsell card: Free plan sem multi_user */}
      {!planLoading && multiUser === false && (
        <section className="empty-state" style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px' }}>Colaboração em equipe</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Seu plano atual não inclui colaboração multiusuário.
            Faça upgrade para o <strong>Growth</strong> e convide até <strong>5 colaboradores</strong>
            {' '}para trabalhar em equipe.
          </p>
          <a
            href="?tab=cobranca"
            className="add-member-btn"
            style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 20px' }}
          >
            Ver planos disponíveis
          </a>
        </section>
      )}

      {/* Se multi_user está carregando, não mostra nada ainda */}
      {planLoading && (
        <section className="section-card">
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Carregando configurações do plano...</p>
        </section>
      )}

      {/* Conteúdo de gerenciamento: só exibe se multi_user está habilitado */}
      {multiUser === true && (
        <>
          {!manageable && (
            <section className="empty-state">
              <h3>Acesso administrativo necessário</h3>
              <p>Apenas proprietários e admins podem gerenciar membros.</p>
            </section>
          )}

          {manageable && (
            <>
              {/* Card de convite */}
              <section className="section-card">
                <h3 className="section-card__title">Convidar novo membro</h3>
                <form onSubmit={handleInviteSubmit} className="invite-form">
                  <div className="invite-form__row">
                    <div className="invite-form__field">
                      <label htmlFor="invite-email">Email do convidado</label>
                      <input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="colaborador@empresa.com"
                      />
                    </div>
                    <div className="invite-form__field">
                      <label htmlFor="invite-role">Perfil de acesso</label>
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
                    </div>
                    <div className="invite-form__action">
                      <label>&nbsp;</label>
                      <button type="submit" className="add-member-btn" disabled={submitLoading}>
                        {submitLoading ? 'Enviando...' : 'Enviar convite'}
                      </button>
                    </div>
                  </div>

                  {inviteError && <div className="auth-error" style={{ marginTop: 8 }}>{inviteError}</div>}
                  {inviteSuccess && (
                    <div className="invite-form__success" style={{ marginTop: 8 }}>
                      {inviteSuccess}
                    </div>
                  )}
                </form>
              </section>

              {/* Tabela de convites pendentes */}
              <section className="section-card">
                <h3 className="section-card__title">
                  Convites enviados
                  {invitations.length > 0 && (
                    <span className="section-card__badge">{invitations.length}</span>
                  )}
                </h3>

                {invitations.length === 0 && (
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    Nenhum convite pendente. Convide alguém pelo formulário acima.
                  </p>
                )}

                {invitations.length > 0 && (
                  <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Perfil</th>
                          <th>Status</th>
                          <th>Convidado em</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((invitation) => (
                          <tr key={invitation.id}>
                            <td>
                              <strong>{invitation.email}</strong>
                            </td>
                            <td>
                              <span className={`role-badge role-badge--${invitation.role}`}>
                                {formatRole(invitation.role)}
                              </span>
                            </td>
                            <td>
                              <span className={`delivery-badge delivery-badge--pending`}>
                                {invitation.status === 'pending' ? 'Aguardando aceite' : invitation.status}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(invitation.created_at)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => copyInviteLink(invitation.token)}
                                  title="Copiar link do convite"
                                >
                                  Copiar link
                                </button>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={async () => {
                                    try {
                                      await inviteMember({
                                        email: invitation.email,
                                        role: invitation.role,
                                      })
                                      setInviteSuccess(`Convite reenviado para ${invitation.email}.`)
                                    } catch (err) {
                                      setInviteError(err instanceof Error ? err.message : 'Erro ao reenviar convite.')
                                    }
                                  }}
                                  title="Reenviar convite"
                                >
                                  Reenviar
                                </button>
                                <button
                                  type="button"
                                  className="delete-task-btn"
                                  onClick={async () => {
                                    try {
                                      await deleteInvitation(invitation.id)
                                      setInviteSuccess(`Convite para ${invitation.email} excluído.`)
                                    } catch (err) {
                                      setInviteError(err instanceof Error ? err.message : 'Erro ao excluir convite.')
                                    }
                                  }}
                                  title="Excluir convite"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Membros atuais */}
          <section className="section-card">
            <h3 className="section-card__title">
              Membros atuais
              {members.length > 0 && (
                <span className="section-card__badge">{members.length}</span>
              )}
            </h3>

            {loading && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Carregando membros...</p>}
            {error && <div className="auth-error">{error}</div>}
            {actionError && <div className="auth-error">{actionError}</div>}

            {!loading && members.length === 0 && (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Nenhum membro listado.</p>
            )}

            {!loading && members.length > 0 && (
              <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Membro</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      {manageable && <th style={{ textAlign: 'right' }}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const canEdit = canEditMembership(actorRole, member.role, member.isCurrentUser)
                      const canSuspend = canSuspendMembership(actorRole, member.role, member.isCurrentUser)
                      const canRemove = canRemoveMembership(actorRole, member.role, member.isCurrentUser)

                      return (
                        <tr key={member.id}>
                          <td>
                            <strong>{member.email}</strong>
                            {member.isCurrentUser && (
                              <span className="role-badge role-badge--owner" style={{ marginLeft: 8, fontSize: '0.75rem' }}>
                                Você
                              </span>
                            )}
                          </td>
                          <td>
                            {manageable ? (
                              <select
                                aria-label={`Perfil de ${member.email}`}
                                value={member.role}
                                disabled={!canEdit}
                                onChange={(event) => handleRoleChange(member.id, event.target.value)}
                                className="role-select"
                              >
                                {assignableRoles.map((role) => (
                                  <option key={role} value={role}>
                                    {formatRole(role)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={`role-badge role-badge--${member.role}`}>
                                {formatRole(member.role)}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`delivery-badge delivery-badge--${member.status === 'active' ? 'sent' : 'pending'}`}>
                              {member.status === 'active' ? 'Ativo' : member.status === 'suspended' ? 'Suspenso' : member.status}
                            </span>
                          </td>
                          {manageable && (
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="action-btn"
                                  disabled={!canSuspend}
                                  onClick={() => handleStatusChange(member.id, member.status === 'suspended' ? 'active' : 'suspended')}
                                >
                                  {member.status === 'suspended' ? 'Reativar' : 'Suspender'}
                                </button>
                                {canRemove && (
                                  <button
                                    type="button"
                                    className="delete-task-btn"
                                    disabled={!canRemove}
                                    onClick={() => handleRemoveMember(member.id)}
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Caso multi_user seja null e nao esteja carregando (erro) - mostra fallback seguro */}
      {!planLoading && multiUser === null && (
        <section className="empty-state">
          <h3>Não foi possível verificar as permissões do plano</h3>
          <p>Tente recarregar a página ou entre em contato com o suporte.</p>
        </section>
      )}
    </div>
  )
}
