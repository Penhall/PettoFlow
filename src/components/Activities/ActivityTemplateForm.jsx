// src/components/Activities/ActivityTemplateForm.jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const ACTIVITY_TYPES = [
  { value: 'meeting',  label: 'Reunião' },
  { value: 'call',     label: 'Ligação' },
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note',     label: 'Nota' },
  { value: 'task',     label: 'Tarefa' },
]

const ActivityTemplateForm = ({ template, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    type: template?.type || '',
    default_notes: template?.default_notes || '',
    default_assigned_to: template?.default_assigned_to || '',
    tagsInput: template?.tags ? template.tags.join(', ') : '',
  })

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const tags = form.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.startsWith('#') ? t : '#' + t)
      .filter(t => t !== '#')

    onSave({
      name: form.name.trim(),
      type: form.type,
      default_notes: form.default_notes,
      default_assigned_to: form.default_assigned_to,
      tags,
    })
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <h2>{template ? 'Editar Modelo' : 'Novo Modelo de Atividade'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Nome *</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => change('name', e.target.value)}
              placeholder="Nome do modelo"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Tipo</label>
            <div className="type-selector">
              {ACTIVITY_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`type-btn ${form.type === t.value ? 'active' : ''}`}
                  onClick={() => change('type', form.type === t.value ? '' : t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Notas padrão</label>
            <textarea
              className="form-input"
              value={form.default_notes}
              onChange={e => change('default_notes', e.target.value)}
              placeholder="Notas que serão pré-preenchidas"
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Responsável padrão</label>
              <input
                type="text"
                className="form-input"
                value={form.default_assigned_to}
                onChange={e => change('default_assigned_to', e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="form-group">
              <label>Tags (separadas por vírgula)</label>
              <input
                type="text"
                className="form-input"
                value={form.tagsInput}
                onChange={e => change('tagsInput', e.target.value)}
                placeholder="ex: followup, urgente"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {template ? 'Salvar Modelo' : 'Criar Modelo'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ActivityTemplateForm
