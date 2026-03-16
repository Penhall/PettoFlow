// src/components/Activities/ActivityForm.jsx
import { useState, useEffect, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar } from 'lucide-react'
import RelationChips from './RelationChips'

// Lazy load do Tiptap — só carrega quando o form é aberto
const TiptapEditor = lazy(() =>
  import('@tiptap/react').then(({ useEditor, EditorContent }) => {
    // Wrapper como componente default exportável
    const Editor = ({ content, onChange }) => {
      const [StarterKit, setStarterKit] = useState(null)
      useEffect(() => {
        import('@tiptap/starter-kit').then(m => setStarterKit(m.default))
      }, [])
      const editor = useEditor({
        extensions: StarterKit ? [StarterKit] : [],
        content: content || '',
        onUpdate: ({ editor }) => onChange(editor.getJSON()),
      }, [StarterKit])
      if (!StarterKit || !editor) return <div className="editor-loading">Carregando editor...</div>
      return (
        <div className="tiptap-wrapper">
          <div className="tiptap-toolbar">
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}>B</button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}>I</button>
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''}>•</button>
          </div>
          <EditorContent editor={editor} className="tiptap-content" />
        </div>
      )
    }
    return { default: Editor }
  })
)

const ACTIVITY_TYPES = [
  { value: 'meeting',  label: 'Reunião' },
  { value: 'call',     label: 'Ligação' },
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note',     label: 'Nota' },
  { value: 'task',     label: 'Tarefa' },
]

const ActivityForm = ({ activity, onSave, onClose, clients, tasks, team }) => {
  const [form, setForm] = useState({
    title: '',
    type: 'meeting',
    body: null,
    status: 'pending',
    scheduled_at: '',
    created_by: '',
    related_to: [],
    ...(activity || {}),
    scheduled_at: activity?.scheduled_at
      ? new Date(activity.scheduled_at).toISOString().slice(0, 16)
      : '',
  })

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
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
        className="modal activity-modal"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <h2>{activity ? 'Editar Atividade' : 'Nova Atividade'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => change('title', e.target.value)}
              placeholder="Assunto da atividade"
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <div className="type-selector">
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`type-btn ${form.type === t.value ? 'active' : ''}`}
                    onClick={() => change('type', t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><Calendar size={13} style={{ marginRight: 4 }} />Data / Hora (lembrete)</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => change('scheduled_at', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Criado por</label>
              <select value={form.created_by} onChange={e => change('created_by', e.target.value)}>
                <option value="">Selecione...</option>
                {team.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Vínculos</label>
            <RelationChips
              value={form.related_to}
              onChange={v => change('related_to', v)}
              clients={clients}
              tasks={tasks}
              team={team}
            />
          </div>

          <div className="form-group">
            <label>Notas</label>
            <Suspense fallback={<div className="editor-loading">Carregando editor...</div>}>
              <TiptapEditor
                content={form.body}
                onChange={v => change('body', v)}
              />
            </Suspense>
          </div>

          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="add-member-btn">
              {activity ? 'Salvar' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ActivityForm
