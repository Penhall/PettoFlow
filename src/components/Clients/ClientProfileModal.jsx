import { useState, useEffect } from 'react'
import { Building2, Phone, Mail, Plus, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RecordSidebar from '../shared/RecordSidebar'

const ClientProfileModal = ({ isOpen, client, clientTasks, onEdit, onClose }) => {
  const [logs, setLogs] = useState([])
  const [newLog, setNewLog] = useState({ type: 'Ligação', notes: '' })
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    if (client?.id) fetchLogs()
  }, [client?.id])

  const fetchLogs = async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('interaction_logs')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    if (!error) setLogs(data || [])
    setLoadingLogs(false)
  }

  const handleAddLog = async (e) => {
    e.preventDefault()
    if (!newLog.notes.trim()) return
    const { data, error } = await supabase
      .from('interaction_logs')
      .insert([{ client_id: client.id, type: newLog.type, notes: newLog.notes }])
      .select()
    if (!error && data) {
      setLogs([data[0], ...logs])
      setNewLog({ type: 'Ligação', notes: '' })
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
              <h3>Negócios</h3>
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
                      <span className={`status-badge ${t.status === 'Concluído' ? 'done' : 'progress'}`}>{t.status}</span>
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
            <h3>Histórico de Interações</h3>
            <form onSubmit={handleAddLog} className="add-log-form">
              <div className="log-type-selector">
                {['Ligação', 'Email', 'Reunião', 'WhatsApp', 'Outro'].map(type => (
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
                  placeholder="Registro de reunião, detalhes da ligação..."
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
                <p className="loading-text">Carregando histórico...</p>
              ) : logs.length === 0 ? (
                <div className="empty-log">
                  <MessageSquare size={32} />
                  <p>Nenhuma interação registrada ainda.</p>
                  <span>Mantenha o histórico de contatos atualizado para vender mais.</span>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="log-item">
                    <div className="log-header">
                      <span className={`log-type-badge type-${log.type.toLowerCase().replace('ç', 'c').replace('ã', 'a')}`}>
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
    </RecordSidebar>
  )
}

export default ClientProfileModal
