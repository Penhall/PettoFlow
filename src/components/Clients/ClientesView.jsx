import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ExternalLink, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const ClientModal = ({ client, onSave, onClose }) => {
  const [form, setForm] = useState(client || {
    name: '',
    industry: '',
    projects: 0,
    revenue: '',
    status: 'Ativo',
    email: '',
    phone: '',
    company_size: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <div className="modal-header">
          <h2>{client ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome da Empresa *</label>
            <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Indústria</label>
              <input type="text" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Ativo</option>
                <option>Em negociação</option>
                <option>Inativo</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input type="text" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Projetos</label>
              <input type="number" value={form.projects} onChange={e => setForm({...form, projects: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Receita Est. (R$)</label>
              <input type="text" value={form.revenue} onChange={e => setForm({...form, revenue: e.target.value})} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">Salvar</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const ClientesView = ({ clients, onRefresh }) => {
  const [editingClient, setEditingClient] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const handleSave = async (form) => {
    const { id, ...payload } = form
    let error
    if (id) {
      ({ error } = await supabase.from('clients').update(payload).eq('id', id))
    } else {
      ({ error } = await supabase.from('clients').insert([payload]))
    }
    
    if (error) console.error('Error saving client:', error)
    else {
      setShowModal(false)
      setEditingClient(null)
      onRefresh()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este cliente?')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) console.error('Error deleting client:', error)
    else onRefresh()
  }

  return (
    <div className="clients-view">
      <div className="section-header-row">
        <h3 className="section-title">Gestão de Clientes</h3>
        <button className="add-member-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="clients-list">
        {clients && clients.map(client => (
          <div key={client.id} className="client-item" onClick={() => { setEditingClient(client); setShowModal(true) }}>
            <div className="client-icon">
              <Building2 size={24} />
            </div>
            <div className="client-main">
              <h3>{client.name}</h3>
              <span>{client.industry}</span>
            </div>
            <div className="client-stats">
              <div className="stat">
                <span className="label">Projetos</span>
                <span className="value">{client.projects}</span>
              </div>
              <div className="stat">
                <span className="label">Receita</span>
                <span className="value">{client.revenue}</span>
              </div>
            </div>
            <div className="client-actions" onClick={e => e.stopPropagation()}>
              <span className={`status-badge ${client.status === 'Ativo' ? 'done' : 'progress'}`}>
                {client.status}
              </span>
              <button className="delete-task-btn" onClick={() => handleDelete(client.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <ClientModal 
            client={editingClient} 
            onSave={handleSave} 
            onClose={() => { setShowModal(false); setEditingClient(null) }} 
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ClientesView
