import { useState } from 'react'
import EmptyState from '../shared/EmptyState.jsx'

export default function TemplatesTab({ templates, onNew, onEdit, onDelete }) {
  const [confirmingId, setConfirmingId] = useState(null)

  const handleConfirmDelete = async (id) => {
    await onDelete(id)
    setConfirmingId(null)
  }

  return (
    <div className="templates-tab">
      <div className="templates-header">
        <h4>Modelos de atividade</h4>
        <p>Padronize abordagens recorrentes e acelere a criacao de atividades operacionais.</p>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Os modelos reduzem repeticao e mantem consistencia no preenchimento de atividades."
          detail="Crie o primeiro modelo para agilizar o fluxo operacional do time."
          action={<button className="page-action-bar__button page-action-bar__button--primary" onClick={onNew}>Novo modelo</button>}
        />
      ) : (
        <div className="templates-list">
          {templates.map((template) => (
            <div key={template.id} className="template-row">
              <div className="template-row__body">
                <div className="template-row__title">{template.name}</div>
                <div className="template-row__meta">
                  {template.type ? <span className="template-row__type">{template.type}</span> : null}
                  {template.default_assigned_to ? <span>{template.default_assigned_to}</span> : null}
                  {template.tags?.map((tag) => (
                    <span key={tag} className="template-row__tag">{tag}</span>
                  ))}
                </div>
              </div>

              {confirmingId === template.id ? (
                <div className="template-row__confirm">
                  <span className="template-row__confirm-copy">Confirmar exclusao?</span>
                  <button className="action-btn sm" onClick={() => handleConfirmDelete(template.id)}>Sim</button>
                  <button className="action-btn sm" onClick={() => setConfirmingId(null)}>Nao</button>
                </div>
              ) : (
                <div className="template-row__actions">
                  <button className="action-btn sm" onClick={() => onEdit(template)}>Editar</button>
                  <button className="action-btn sm" onClick={() => setConfirmingId(template.id)}>Excluir</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
