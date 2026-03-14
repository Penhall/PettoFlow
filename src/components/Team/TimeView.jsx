import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const MemberModal = ({ member, onSave, onClose }) => {
  const [form, setForm] = useState(member || {
    name: '',
    role: '',
    email: '',
    phone: '',
    status: 'Ativo'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <div className="modal-header">
          <h2>{member ? 'Editar Membro' : 'Novo Membro'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome Completo *</label>
            <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Cargo / Função</label>
            <input type="text" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Ativo</option>
                <option>Ocupado</option>
                <option>Ausente</option>
              </select>
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

const TimeView = ({ tasks, team, onRefresh, searchQuery }) => {
  const [editingMember, setEditingMember] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const members = (team || []).map(member => {
    const memberTasks = tasks.filter(t => t.owner === member.name)
    const done = memberTasks.filter(t => t.status === 'Concluído').length
    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2)
    return { ...member, initials, memberTasks, done }
  }).filter(member => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (member.name || '').toLowerCase().includes(q) || 
           (member.role || '').toLowerCase().includes(q)
  })

  const handleSave = async (form) => {
    const { id, initials: _i, memberTasks: _m, done: _d, ...payload } = form
    let error
    if (id) {
      ({ error } = await supabase.from('team').update(payload).eq('id', id))
    } else {
      ({ error } = await supabase.from('team').insert([payload]))
    }
    
    if (error) console.error('Error saving member:', error)
    else {
      setShowModal(false)
      setEditingMember(null)
      onRefresh()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este membro do time?')) return
    const { error } = await supabase.from('team').delete().eq('id', id)
    if (error) console.error('Error deleting member:', error)
    else onRefresh()
  }

  return (
    <div className="team-view">
      <div className="section-header-row">
        <h3 className="section-title">Membros do Time</h3>
        <button className="add-member-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Novo Membro
        </button>
      </div>

      <div className="team-grid">
        {members.map((member) => (
          <div key={member.id} className="member-card" onClick={() => { setEditingMember(member); setShowModal(true) }}>
            <div className="member-header">
              <div className="avatar">{member.initials}</div>
              <div className="member-info">
                <h3>{member.name}</h3>
                <span className="role">{member.memberTasks.length} tarefa{member.memberTasks.length !== 1 ? 's' : ''} · {member.done} concluída{member.done !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="member-actions" onClick={e => e.stopPropagation()}>
              <button className="action-icon-btn"><Mail size={16} /></button>
              <button className="delete-task-btn" onClick={() => handleDelete(member.id)}><Trash2 size={16} /></button>
            </div>
            <div className="member-tasks">
              {member.memberTasks.slice(0, 3).map(t => (
                <div key={t.id} className="member-task-row">
                  <span>{t.title}</span>
                </div>
              ))}
              {member.memberTasks.length > 3 && (
                <div className="more-tasks-count">+{member.memberTasks.length - 3} mais</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <MemberModal 
            member={editingMember} 
            onSave={handleSave} 
            onClose={() => { setShowModal(false); setEditingMember(null) }} 
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default TimeView
