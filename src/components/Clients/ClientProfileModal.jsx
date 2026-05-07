import { useCallback, useEffect, useState } from 'react'
import { Building2, Mail, MessageSquare, Phone, Plus } from 'lucide-react'
import { useAccounts } from '../../hooks/useAccounts'
import { useFinCategories } from '../../hooks/useFinCategories'
import { usePayees } from '../../hooks/usePayees'
import { useTransactions } from '../../hooks/useTransactions'
import {
  createInteractionLogRecord,
  listInteractionLogRecords,
} from '../../lib/workspaceCore'
import TransactionList from '../Finance/TransactionList'
import RecordSidebar from '../shared/RecordSidebar'

const LOG_TYPES = ['Ligacao', 'Email', 'Reuniao', 'WhatsApp', 'Outro']

const normalizeLogType = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function ClientTransactions({ clientId }) {
  const { transactions: clientTransactions, loading } = useTransactions({ relatedTo: { type: 'client', id: clientId } })
  const { accounts } = useAccounts()
  const { payees } = usePayees()
  const { categories } = useFinCategories()

  return (
    <section className="client-profile-section">
      <div className="client-profile-section__header">
        <div>
          <span className="client-profile-section__eyebrow">Financeiro</span>
          <h3>Transacoes vinculadas</h3>
        </div>
      </div>

      <TransactionList
        transactions={clientTransactions}
        accounts={accounts}
        payees={payees}
        categories={categories}
        onEdit={() => {}}
        onDelete={() => {}}
        onApplyRules={() => {}}
        loading={loading}
      />
    </section>
  )
}

export default function ClientProfileModal({ isOpen, client, clientTasks = [], onEdit, onClose }) {
  const [logs, setLogs] = useState([])
  const [newLog, setNewLog] = useState({ type: 'Ligacao', notes: '' })
  const [loadingLogs, setLoadingLogs] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!client?.id) return

    setLoadingLogs(true)

    try {
      const data = await listInteractionLogRecords(client.id)
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching interaction logs:', error)
    } finally {
      setLoadingLogs(false)
    }
  }, [client?.id])

  useEffect(() => {
    if (client?.id) {
      fetchLogs()
    }
  }, [client?.id, fetchLogs])

  const handleAddLog = async (event) => {
    event.preventDefault()

    if (!newLog.notes.trim() || !client?.id) return

    try {
      const created = await createInteractionLogRecord({
        client_id: client.id,
        type: newLog.type,
        notes: newLog.notes,
      })

      setLogs((current) => [created, ...current])
      setNewLog({ type: 'Ligacao', notes: '' })
    } catch (error) {
      console.error('Error adding interaction log:', error)
    }
  }

  return (
    <RecordSidebar
      isOpen={isOpen}
      onClose={onClose}
      title={client?.name}
      subtitle={client ? `${client.industry || 'Industria nao definida'} · ${client.status || 'Status nao definido'}` : ''}
    >
      {client ? (
        <div className="client-profile">
          <div className="client-profile__grid">
            <aside className="client-profile__summary">
              <section className="client-profile-card">
                <div className="client-profile-card__header">
                  <div>
                    <span className="client-profile-card__eyebrow">Contato</span>
                    <h3>Dados principais</h3>
                  </div>
                </div>

                <div className="client-profile-card__stack">
                  <div className="client-profile-card__row">
                    <Mail size={14} />
                    <span>{client.email || 'Sem email principal'}</span>
                  </div>
                  <div className="client-profile-card__row">
                    <Phone size={14} />
                    <span>{client.phone || 'Sem telefone principal'}</span>
                  </div>
                  <div className="client-profile-card__row">
                    <Building2 size={14} />
                    <span>{client.company_size || 'Porte nao informado'}</span>
                  </div>
                </div>
              </section>

              <section className="client-profile-card">
                <div className="client-profile-card__header">
                  <div>
                    <span className="client-profile-card__eyebrow">Comercial</span>
                    <h3>Negocio atual</h3>
                  </div>
                </div>

                <div className="client-profile-card__stats">
                  <div>
                    <span>Receita estimada</span>
                    <strong>{client.revenue || 'R$ 0'}</strong>
                  </div>
                  <div>
                    <span>Projetos ativos</span>
                    <strong>{client.projects || 0}</strong>
                  </div>
                  <div>
                    <span>Tarefas vinculadas</span>
                    <strong>{clientTasks.length}</strong>
                  </div>
                </div>
              </section>

              <section className="client-profile-card">
                <div className="client-profile-card__header">
                  <div>
                    <span className="client-profile-card__eyebrow">Operacao</span>
                    <h3>Tarefas relacionadas</h3>
                  </div>
                </div>

                <div className="client-profile-task-list">
                  {clientTasks.length === 0 ? (
                    <p className="client-profile-card__empty">Nenhuma tarefa associada a este cliente.</p>
                  ) : (
                    clientTasks.map((task) => (
                      <div key={task.id} className="client-profile-task-row">
                        <div className="client-profile-task-row__copy">
                          <strong>{task.title}</strong>
                          <span>{task.owner || 'Sem responsavel definido'}</span>
                        </div>
                        <span className={`status-badge ${task.completed_at ? 'done' : 'progress'}`}>
                          {task.status || 'A Fazer'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <button type="button" className="page-action-bar__button page-action-bar__button--primary client-profile__edit" onClick={() => onEdit(client)}>
                <Building2 size={14} />
                <span>Editar cliente</span>
              </button>
            </aside>

            <section className="client-profile-section">
              <div className="client-profile-section__header">
                <div>
                  <span className="client-profile-section__eyebrow">Relacionamento</span>
                  <h3>Historico de interacoes</h3>
                </div>
              </div>

              <form onSubmit={handleAddLog} className="client-log-form">
                <div className="client-log-form__types">
                  {LOG_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`client-log-type ${newLog.type === type ? 'is-active' : ''}`}
                      onClick={() => setNewLog((current) => ({ ...current, type }))}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="client-log-form__composer">
                  <input
                    type="text"
                    placeholder="Registro de reuniao, detalhes da ligacao ou proximos passos"
                    value={newLog.notes}
                    onChange={(event) => setNewLog((current) => ({ ...current, notes: event.target.value }))}
                  />
                  <button type="submit" className="page-action-bar__button page-action-bar__button--primary" disabled={!newLog.notes.trim()}>
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </form>

              <div className="client-log-list">
                {loadingLogs ? (
                  <p className="client-log-list__loading">Carregando historico...</p>
                ) : logs.length === 0 ? (
                  <div className="client-log-list__empty">
                    <MessageSquare size={26} />
                    <strong>Nenhuma interacao registrada</strong>
                    <p>Documente contatos, reunioes e follow-ups para manter o relacionamento utilizavel por toda a equipe.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <article key={log.id} className="client-log-item">
                      <div className="client-log-item__header">
                        <span className={`client-log-item__type type-${normalizeLogType(log.type)}`}>
                          {log.type}
                        </span>
                        <span className="client-log-item__date">
                          {new Date(log.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p>{log.notes}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          {client.id ? <ClientTransactions clientId={client.id} /> : null}
        </div>
      ) : null}
    </RecordSidebar>
  )
}
