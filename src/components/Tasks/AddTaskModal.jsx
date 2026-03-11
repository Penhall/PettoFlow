import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const AddTaskModal = ({ onAdd, onClose, defaultStatus }) => {
  const [form, setForm] = useState({
    title: '',
    status: defaultStatus,
    priority: 'Média',
    owner: '',
    tags: [],
    progress: 0,
  })

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd(form)
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Nova Tarefa</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => change('title', e.target.value)}
              placeholder="Nome da tarefa"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => change('status', e.target.value)}>
                <option>A Fazer</option>
                <option>Em Progresso</option>
                <option>Concluído</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select value={form.priority} onChange={e => change('priority', e.target.value)}>
                <option>Alta</option>
                <option>Média</option>
                <option>Baixa</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Responsável</label>
            <input
              type="text"
              value={form.owner}
              onChange={e => change('owner', e.target.value)}
              placeholder="Nome do responsável"
            />
          </div>

          <div className="form-group">
            <label>Progresso: {form.progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={form.progress}
              onChange={e => change('progress', Number(e.target.value))}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">Criar Tarefa</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default AddTaskModal
