// src/components/Activities/ActivityForm.jsx
import { useRef, useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, FileText, ChevronDown } from 'lucide-react'
import RelationChips from './RelationChips'
import { realToCents } from '../../lib/finUtils'
import { lazyWithRetry } from '../../lib/lazyWithRetry.js'
import { getMutationData, getMutationMessage, isMutationOk } from '../../lib/mutationResult.js'

// Lazy load do Tiptap — carrega ambos os pacotes juntos
const TiptapEditor = lazyWithRetry(() =>
  Promise.all([
    import('@tiptap/react'),
    import('@tiptap/starter-kit'),
  ]).then(([{ useEditor, EditorContent }, { default: StarterKit }]) => {
    const Editor = ({ content, onChange }) => {
      const onChangeRef = useRef(onChange)
      // Mantém ref atualizado sem re-criar o editor
      onChangeRef.current = onChange

      const editor = useEditor({
        extensions: [StarterKit],
        content: content || '',
        onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
      })
      if (!editor) return <div className="editor-loading">Carregando editor...</div>
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
  }),
  'activity-tiptap-editor',
)

const ACTIVITY_TYPES = [
  { value: 'meeting',  label: 'Reunião' },
  { value: 'call',     label: 'Ligação' },
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note',     label: 'Nota' },
  { value: 'task',     label: 'Tarefa' },
]

const ActivityForm = ({
  activity, onSave, onClose,
  clients = [], tasks = [], team = [], templates = [], onApplyTemplate,
  addTransaction,
  createReceivableFromActivity,
  principalAccountId,
}) => {
  const [form, setForm] = useState({
    title: '',
    type: 'meeting',
    body: null,
    status: 'pending',
    created_by: '',
    related_to: [],
    ...(activity || {}),
    scheduled_at: activity?.scheduled_at
      ? new Date(activity.scheduled_at).toISOString().slice(0, 16)
      : '',
  })
  const [submitError, setSubmitError] = useState(null)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [finOpen, setFinOpen] = useState(false)
  const [finMode, setFinMode] = useState('transaction') // 'transaction' | 'receivable'
  const [finAmount, setFinAmount] = useState('')
  const [finDate, setFinDate] = useState(new Date().toISOString().slice(0, 10))

  const change = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleUseTemplate = (e) => {
    const templateId = Number(e.target.value)
    if (!templateId || !onApplyTemplate) return
    const prefilled = onApplyTemplate(templateId)
    if (!prefilled) return
    setForm(prev => ({
      ...prev,
      ...(prefilled.type ? { type: prefilled.type } : {}),
      ...(prefilled.notes ? { body: prefilled.notes } : {}),
      ...(prefilled.assigned_to ? { created_by: prefilled.assigned_to } : {}),
    }))
    setShowTemplateSelector(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitError(null)
    try {
      const saveResult = await onSave({
        ...form,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      })
      if (!isMutationOk(saveResult)) {
        setSubmitError(getMutationMessage(saveResult))
        return
      }
      const savedActivity = getMutationData(saveResult)

      if (!savedActivity?.id) {
        setSubmitError('Erro ao salvar atividade. Tente novamente.')
        return
      }

      if (finOpen && finAmount) {
        const amountCents = realToCents(finAmount)
        if (amountCents > 0) {
          if (finMode === 'transaction' && addTransaction) {
            if (!principalAccountId) {
              setSubmitError('Defina uma conta principal em Finanças > Contas antes de registrar o valor.')
              return
            } else {
              const transactionResult = await addTransaction({
                account_id: principalAccountId,
                amount: amountCents,
                date: finDate,
                notes: `Atividade: ${form.title}`,
                related_to: [{ type: 'activity', id: savedActivity.id }],
              })
              if (!isMutationOk(transactionResult)) {
                setSubmitError(getMutationMessage(transactionResult))
                return
              }
            }
          } else if (finMode === 'receivable' && createReceivableFromActivity) {
            const receivableResult = await createReceivableFromActivity(
              savedActivity.id, amountCents, principalAccountId ?? null, finDate
            )
            if (!isMutationOk(receivableResult)) {
              setSubmitError(getMutationMessage(receivableResult))
              return
            }
          }
        }
      }
    } catch (err) {
      setSubmitError('Erro ao salvar. Tente novamente.')
    }
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
          {templates.length > 0 && (
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              {!showTemplateSelector ? (
                <button
                  type="button"
                  className="action-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setShowTemplateSelector(true)}
                >
                  <FileText size={14} /> Usar Modelo
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    className="form-input"
                    defaultValue=""
                    onChange={handleUseTemplate}
                    style={{ flex: 1 }}
                    autoFocus
                  >
                    <option value="" disabled>Selecione um modelo...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowTemplateSelector(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

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

          <div className="form-group" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}
              onClick={() => setFinOpen(v => !v)}
            >
              <span>＋ Registrar valor financeiro</span>
              <ChevronDown size={14} style={{ transform: finOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
            </button>

            {finOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: '12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" value="transaction" checked={finMode === 'transaction'} onChange={() => setFinMode('transaction')} />
                    Transação imediata
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" value="receivable" checked={finMode === 'receivable'} onChange={() => setFinMode('receivable')} />
                    A Receber
                  </label>
                </div>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Valor (ex: 1.500,00)"
                  value={finAmount}
                  onChange={e => setFinAmount(e.target.value)}
                />
                <input
                  className="form-input"
                  type="date"
                  value={finDate}
                  onChange={e => setFinDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {submitError && (
            <p style={{ color: 'var(--error, #ef4444)', fontSize: 13, margin: '4px 0 0' }}>{submitError}</p>
          )}

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
