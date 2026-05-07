// src/components/Activities/TemplatesTab.jsx
import { useState } from 'react'
import EmptyState from '../shared/EmptyState.jsx'

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
      <div className="templates-header">
        <h4>Modelos de atividade</h4>
        <p>Padronize abordagens recorrentes e acelere a criação de atividades operacionais.</p>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Os modelos reduzem repetição e mantêm consistência no preenchimento de atividades."
          detail="Crie o primeiro modelo para agilizar o fluxo operacional do time."
          action={<button className="page-action-bar__button page-action-bar__button--primary" onClick={onNew}>Novo modelo</button>}
        />
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
