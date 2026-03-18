// src/components/Activities/TemplatesTab.jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'

const TemplatesTab = ({ templates, onNew, onEdit, onDelete }) => {
  const [confirmingId, setConfirmingId] = useState(null)

  const handleDeleteClick = (id) => {
    setConfirmingId(id)
  }

  const handleConfirmDelete = async (id) => {
    await onDelete(id)
    setConfirmingId(null)
  }

  const handleCancelDelete = () => {
    setConfirmingId(null)
  }

  return (
    <div className="templates-tab">
      <div className="templates-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Modelos de Atividade</h4>
        <button className="add-member-btn" onClick={onNew}>
          <Plus size={16} /> Novo Modelo
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #888)' }}>
          <p>Nenhum modelo cadastrado ainda.</p>
          <p style={{ fontSize: '0.875rem' }}>Crie modelos para agilizar o preenchimento de atividades.</p>
        </div>
      ) : (
        <div className="templates-list">
          {templates.map(template => (
            <div key={template.id} className="template-row" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border, #e2e8f0)',
              marginBottom: '0.5rem',
              background: 'var(--surface, #fff)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{template.name}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted, #666)' }}>
                  {template.type && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--accent-light, #e8f4ff)',
                      color: 'var(--accent, #0070f3)',
                      fontWeight: 500,
                    }}>
                      {template.type}
                    </span>
                  )}
                  {template.default_assigned_to && (
                    <span>{template.default_assigned_to}</span>
                  )}
                  {template.tags && template.tags.length > 0 && template.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--tag-bg, #f0f0f0)',
                      color: 'var(--text-muted, #555)',
                      fontSize: '0.75rem',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {confirmingId === template.id ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted, #666)' }}>Confirmar exclusão?</span>
                    <button
                      className="action-btn sm"
                      style={{ color: 'var(--danger, #e53e3e)' }}
                      onClick={() => handleConfirmDelete(template.id)}
                    >
                      Sim
                    </button>
                    <button
                      className="action-btn sm"
                      onClick={handleCancelDelete}
                    >
                      Não
                    </button>
                  </span>
                ) : (
                  <>
                    <button className="action-btn sm" onClick={() => onEdit(template)}>Editar</button>
                    <button className="action-btn sm" onClick={() => handleDeleteClick(template.id)}>Excluir</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TemplatesTab
