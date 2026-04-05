import { useState, useEffect, useCallback } from 'react'
import { Building2, Phone, Mail, Plus, MessageSquare } from 'lucide-react'
import RecordSidebar from '../shared/RecordSidebar'
import { useTransactions }  from '../../hooks/useTransactions'
import { useAccounts }      from '../../hooks/useAccounts'
import { usePayees }        from '../../hooks/usePayees'
import { useFinCategories } from '../../hooks/useFinCategories'
import {
  listInteractionLogRecords,
  createInteractionLogRecord,
} from '../../lib/workspaceCore'
import TransactionList      from '../Finance/TransactionList'

const normalizeLogType = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const ClientTransactions = ({ clientId }) => {
  const { transactions: clientTxs, loading: txLoading } = useTransactions({ relatedTo: { type: 'client', id: clientId } })
  const { accounts } = useAccounts()
  const { payees } = usePayees()
  const { categories } = useFinCategories()

  return (
    <div className="client-transactions-section">
      <h3>Transacoes Vinculadas</h3>
      <TransactionList
        transactions={clientTxs}
        accounts={accounts}
        payees={payees}
        categories={categories}
        onEdit={() => {}}
        onDelete={() => {}}
        onApplyRules={() => {}}
        loading={txLoading}
      />
    </div>
  )
}

const ClientProfileModal = ({ isOpen, client, clientTasks, onEdit, onClose }) => {
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
    if (client?.id) fetchLogs()
  }, [client?.id, fetchLogs])

  const handleAddLog = async (e) => {
    e.preventDefault()
    if (!newLog.notes.trim() || !client?.id) return

    try {
      const created = await createInteractionLogRecord({
        client_id: client.id,
        type: newLog.type,
        notes: newLog.notes,
      })
      setLogs(prev => [created, ...prev])
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
      subtitle={client ? `${client.industry || ''} • ${client.status || ''}` : ''}
    >
      {client && (
        <div className="profile-body">
          <div className="profile-sidebar">
            <div className="info-card">
              <h3>Contato</h3>
              <p><Mail size={14} /> {client.email || 'Sem email'}</p>
              <p><Phone size={14} /> {client.phone || 'Sem telefone'}</p>
            </div>
            <div className="info-card">
              <h3>Negocios</h3>
              <p>Receita Est.: <strong>{client.revenue || 'R$ 0'}</strong></p>
              <p>Projetos Ativos: <strong>{client.projects || 0}</strong></p>
            </div>
            <div className="related-tasks">
              <h3>Tarefas Vinculadas ({(clientTasks || []).length})</h3>
              <div className="task-list-mini">
                {(clientTasks || []).length === 0 ? (
                  <p className="empty-text">Nenhuma tarefa associada.</p>
                ) : (
                  (clientTasks || []).map(t => (
                    <div key={t.id} className="task-mini-card">
                      <span className="task-mini-title">{t.title}</span>
                      <span className={`status-badge ${t.status === 'Concluido' ? 'done' : 'progress'}`}>{t.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <button className="action-btn" style={{ marginTop: 12 }} onClick={() => onEdit(client)}>
              <Building2 size={14} style={{ marginRight: 6 }} />
              Editar Cliente
            </button>
          </div>

          <div className="interaction-feed">
            <h3>Historico de Interacoes</h3>
            <form onSubmit={handleAddLog} className="add-log-form">
              <div className="log-type-selector">
                {['Ligacao', 'Email', 'Reuniao', 'WhatsApp', 'Outro'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`log-type-btn ${newLog.type === type ? 'active' : ''}`}
                    onClick={() => setNewLog({ ...newLog, type })}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="log-input-row">
                <input
                  type="text"
                  placeholder="Registro de reuniao, detalhes da ligacao..."
                  value={newLog.notes}
                  onChange={e => setNewLog({ ...newLog, notes: e.target.value })}
                />
                <button type="submit" className="add-log-btn" disabled={!newLog.notes.trim()}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </form>

            <div className="logs-list">
              {loadingLogs ? (
                <p className="loading-text">Carregando historico...</p>
              ) : logs.length === 0 ? (
                <div className="empty-log">
                  <MessageSquare size={32} />
                  <p>Nenhuma interacao registrada ainda.</p>
                  <span>Mantenha o historico de contatos atualizado para vender mais.</span>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="log-item">
                    <div className="log-header">
                      <span className={`log-type-badge type-${normalizeLogType(log.type)}`}>
                        {log.type}
                      </span>
                      <span className="log-date">
                        {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="log-notes">{log.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {client?.id && <ClientTransactions clientId={client.id} />}
    </RecordSidebar>
  )
}

export default ClientProfileModal
