import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, PencilLine, Trash2, X } from 'lucide-react'
import { MOTION_TRANSITIONS } from '../../lib/motionTokens.js'
import { deleteTeamMemberRecord, saveTeamMemberRecord } from '../../lib/workspaceCore'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

function MemberModal({ member, onSave, onClose }) {
  const [form, setForm] = useState(
    member || {
      name: '',
      role: '',
      email: '',
      phone: '',
      status: 'Ativo',
    }
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave(form)
  }

  return (
    <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={MOTION_TRANSITIONS.fade}>
      <motion.div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={MOTION_TRANSITIONS.modal}
      >
        <div className="modal-header">
          <h2>{member ? 'Editar membro' : 'Novo membro'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome completo *</label>
            <input required type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>

          <div className="form-group">
            <label>Cargo ou função</label>
            <input type="text" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Ativo</option>
                <option>Ocupado</option>
                <option>Ausente</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">Salvar membro</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function getMemberStatusTone(status) {
  if (status === 'Ativo') return 'done'
  if (status === 'Ocupado') return 'progress'
  return 'todo'
}

export default function TimeView({ tasks = [], team = [], onRefresh, searchQuery }) {
  const [editingMember, setEditingMember] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const members = (team || [])
    .map((member) => {
      const memberTasks = tasks.filter((task) => task.owner === member.name)
      const completedCount = memberTasks.filter((task) => task.completed_at).length
      const initials = member.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

      return {
        ...member,
        initials,
        memberTasks,
        completedCount,
      }
    })
    .filter((member) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (member.name || '').toLowerCase().includes(query) || (member.role || '').toLowerCase().includes(query)
    })

  const totalAssignedTasks = members.reduce((sum, member) => sum + member.memberTasks.length, 0)
  const activeMembers = members.filter((member) => member.status === 'Ativo').length

  const closeModal = () => {
    setShowModal(false)
    setEditingMember(null)
  }

  const handleSave = async (form) => {
    const payload = { ...form }
    const { id } = payload

    delete payload.initials
    delete payload.memberTasks
    delete payload.completedCount

    try {
      await saveTeamMemberRecord({ ...payload, id })
      closeModal()
      onRefresh()
    } catch (error) {
      console.error('Error saving member:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este membro do time?')) return

    try {
      await deleteTeamMemberRecord(id)
      onRefresh()
    } catch (error) {
      console.error('Error deleting member:', error)
    }
  }

  return (
    <div className="team-page">
      <PageHeader
        eyebrow="Espaço de trabalho"
        title="Time"
        subtitle="Gerencie membros, distribuição de trabalho e sinais operacionais da equipe sem perder densidade."
        metrics={[
          { label: 'Membros visíveis', value: String(members.length) },
          { label: 'Ativos agora', value: String(activeMembers) },
          { label: 'Tarefas alocadas', value: String(totalAssignedTasks) },
        ]}
      />

      <PageActionBar
        meta={`${members.length} ${members.length === 1 ? 'membro encontrado' : 'membros encontrados'}`}
        primaryAction={{
          label: 'Novo membro',
          onClick: () => {
            setEditingMember(null)
            setShowModal(true)
          },
        }}
      />

      <div className="team-page__content">
        {members.length === 0 ? (
          <SurfaceCard>
            <EmptyState
              title="O time aparece aqui como camada operacional"
              description="Acompanhe distribuição de trabalho, responsáveis e sinais de capacidade da equipe."
              detail={
                searchQuery
                  ? 'Nenhum membro corresponde aos filtros atuais.'
                  : 'Esta área está vazia porque nenhum membro foi cadastrado no espaço de trabalho.'
              }
            />
          </SurfaceCard>
        ) : (
          <SurfaceCard className="team-page__list" padded={false}>
            <div className="team-page__list-header" role="presentation">
              <span>Pessoa</span>
              <span>Capacidade</span>
              <span>Foco recente</span>
              <span>Ações</span>
            </div>

            {members.map((member) => (
              <article key={member.id} className="team-member-row">
                <div className="team-member-row__identity">
                  <span className="team-member-row__avatar" aria-hidden="true">{member.initials}</span>
                  <div className="team-member-row__copy">
                    <strong>{member.name}</strong>
                    <span>{member.role || 'Função não definida'}</span>
                  </div>
                </div>

                <div className="team-member-row__metrics">
                  <span>{member.memberTasks.length} tarefa{member.memberTasks.length === 1 ? '' : 's'}</span>
                  <span>{member.completedCount} concluídas</span>
                  <span className={`status-badge ${getMemberStatusTone(member.status)}`}>{member.status || 'Ativo'}</span>
                </div>

                <div className="team-member-row__tasks">
                  {member.memberTasks.length ? (
                    member.memberTasks.slice(0, 3).map((task) => (
                      <span key={task.id} className="team-member-row__task-chip">{task.title}</span>
                    ))
                  ) : (
                    <span className="team-member-row__placeholder">Sem tarefas vinculadas</span>
                  )}
                </div>

                <div className="team-member-row__actions">
                  {member.email ? (
                    <a className="page-action-bar__button" href={`mailto:${member.email}`}>
                      <Mail size={14} />
                      <span>Email</span>
                    </a>
                  ) : null}

                  <button
                    type="button"
                    className="page-action-bar__button"
                    onClick={() => {
                      setEditingMember(member)
                      setShowModal(true)
                    }}
                  >
                    <PencilLine size={14} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    className="page-action-bar__button team-member-row__danger"
                    onClick={() => handleDelete(member.id)}
                  >
                    <Trash2 size={14} />
                    <span>Remover</span>
                  </button>
                </div>
              </article>
            ))}
          </SurfaceCard>
        )}
      </div>

      <AnimatePresence>
        {showModal ? (
          <MemberModal member={editingMember} onSave={handleSave} onClose={closeModal} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
