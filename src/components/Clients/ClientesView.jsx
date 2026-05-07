import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, PencilLine, Trash2, X } from 'lucide-react'
import { MOTION_TRANSITIONS } from '../../lib/motionTokens.js'
import { deleteClientRecord, saveClientRecord } from '../../lib/workspaceCore'
import ClientProfileModal from './ClientProfileModal'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import SurfaceCard from '../shared/SurfaceCard.jsx'

function ClientModal({ client, onSave, onClose }) {
  const [form, setForm] = useState(
    client || {
      name: '',
      industry: '',
      projects: 0,
      revenue: '',
      status: 'Ativo',
      email: '',
      phone: '',
      company_size: '',
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
          <h2>{client ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome da empresa *</label>
            <input required type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Indústria</label>
              <input type="text" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Ativo</option>
                <option>Em negociação</option>
                <option>Inativo</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input type="text" value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Projetos</label>
              <input
                type="number"
                value={form.projects}
                onChange={(event) => setForm({ ...form, projects: Number(event.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>Receita estimada (R$)</label>
              <input type="text" value={form.revenue} onChange={(event) => setForm({ ...form, revenue: event.target.value })} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">Salvar cliente</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function getClientStatusTone(status) {
  if (status === 'Ativo') return 'done'
  if (status === 'Inativo') return 'todo'
  return 'progress'
}

export default function ClientesView({ clients = [], tasks = [], onRefresh, searchQuery }) {
  const [editingClient, setEditingClient] = useState(null)
  const [viewingClient, setViewingClient] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const visibleClients = (clients || [])
    .filter((client) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (client.name || '').toLowerCase().includes(query) || (client.industry || '').toLowerCase().includes(query)
    })
    .map((client) => {
      const relatedTasks = tasks.filter((task) => task.client_id === client.id)
      const openValue = relatedTasks.reduce((sum, task) => sum + Number(task.deal_value || 0), 0)

      return {
        ...client,
        relatedTasks,
        openValue,
      }
    })

  const industriesCount = new Set(visibleClients.map((client) => client.industry).filter(Boolean)).size
  const openTaskCount = visibleClients.reduce((sum, client) => sum + client.relatedTasks.length, 0)

  const closeModal = () => {
    setShowEditModal(false)
    setEditingClient(null)
  }

  const handleSave = async (form) => {
    try {
      await saveClientRecord(form)
      closeModal()
      onRefresh()
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este cliente?')) return

    try {
      await deleteClientRecord(id)
      onRefresh()
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  return (
    <div className="clients-page">
      <PageHeader
        eyebrow="Espaço de trabalho"
        title="Clientes"
        subtitle="Consulte carteira, contexto comercial e histórico principal sem perder ritmo operacional."
        metrics={[
          { label: 'Clientes visíveis', value: String(visibleClients.length) },
          { label: 'Indústrias ativas', value: String(industriesCount) },
          { label: 'Tarefas relacionadas', value: String(openTaskCount) },
        ]}
      />

      <PageActionBar
        meta={`${visibleClients.length} ${visibleClients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}`}
        primaryAction={{
          label: 'Novo cliente',
          onClick: () => {
            setEditingClient(null)
            setShowEditModal(true)
          },
        }}
      />

      <div className="clients-page__content">
        {visibleClients.length === 0 ? (
          <SurfaceCard>
            <EmptyState
              title="A carteira de clientes vira uma camada operacional aqui"
              description="Visualize portfolio, status comercial e relacionamento em uma superficie mais limpa."
              detail={
                searchQuery
                  ? 'Nenhum cliente corresponde aos filtros atuais.'
                  : 'Esta área está vazia porque nenhum cliente foi cadastrado no espaço de trabalho.'
              }
            />
          </SurfaceCard>
        ) : (
          <SurfaceCard className="clients-page__list" padded={false}>
            <div className="clients-page__list-header" role="presentation">
              <span>Conta</span>
              <span>Relacionamento</span>
              <span>Receita e projetos</span>
              <span>Ações</span>
            </div>

            {visibleClients.map((client) => (
              <article key={client.id} className="client-row">
                <div className="client-row__identity">
                  <span className="client-row__icon" aria-hidden="true">
                    <Building2 size={16} strokeWidth={1.85} />
                  </span>
                  <div className="client-row__copy">
                    <strong>{client.name}</strong>
                    <span>{client.industry || 'Indústria não definida'}</span>
                  </div>
                </div>

                <div className="client-row__relationship">
                  <span>{client.email || 'Sem email principal'}</span>
                  <span>{client.phone || 'Sem telefone principal'}</span>
                  <span className={`status-badge ${getClientStatusTone(client.status)}`}>{client.status || 'Ativo'}</span>
                </div>

                <div className="client-row__stats">
                  <span>{client.projects || 0} projeto{client.projects === 1 ? '' : 's'}</span>
                  <span>{client.revenue || 'R$ 0'}</span>
                  <span>{client.relatedTasks.length} tarefa{client.relatedTasks.length === 1 ? '' : 's'} em curso</span>
                </div>

                <div className="client-row__actions">
                  <button
                    type="button"
                    className="page-action-bar__button"
                    onClick={() => setViewingClient(client)}
                  >
                    <span>Abrir</span>
                  </button>

                  <button
                    type="button"
                    className="page-action-bar__button"
                    onClick={() => {
                      setEditingClient(client)
                      setShowEditModal(true)
                    }}
                  >
                    <PencilLine size={14} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    className="page-action-bar__button client-row__danger"
                    onClick={() => handleDelete(client.id)}
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                </div>
              </article>
            ))}
          </SurfaceCard>
        )}
      </div>

      <AnimatePresence>
        {showEditModal ? (
          <ClientModal client={editingClient} onSave={handleSave} onClose={closeModal} />
        ) : null}
      </AnimatePresence>

      <ClientProfileModal
        isOpen={Boolean(viewingClient)}
        client={viewingClient}
        clientTasks={(tasks || []).filter((task) => task.client_id === viewingClient?.id)}
        onEdit={(client) => {
          setEditingClient(client)
          setShowEditModal(true)
        }}
        onClose={() => setViewingClient(null)}
      />
    </div>
  )
}
