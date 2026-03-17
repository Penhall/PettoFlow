// src/components/Finance/RuleBuilder.jsx
import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'

const CONDITION_FIELDS = [
  { value: 'payee_name', label: 'Pagador'           },
  { value: 'amount',     label: 'Valor (centavos)'  },
  { value: 'notes',      label: 'Notas'             },
  { value: 'account_id', label: 'Conta ID'          },
  { value: 'date',       label: 'Data'              },
]

// Operadores por campo — conforme tabela da spec (evitar oferecer ops inválidas)
const FIELD_OPS = {
  payee_name: [
    { value: 'contains',       label: 'contém'              },
    { value: 'not_contains',   label: 'não contém'          },
    { value: 'is',             label: 'é exatamente'        },
    { value: 'is_not',         label: 'não é'               },
    { value: 'starts_with',    label: 'começa com'          },
    { value: 'matches_regexp', label: 'corresponde a regexp'},
  ],
  amount: [
    { value: 'is',           label: 'é igual a' },
    { value: 'greater_than', label: 'maior que'  },
    { value: 'less_than',    label: 'menor que'  },
  ],
  notes: [
    { value: 'contains',     label: 'contém'     },
    { value: 'not_contains', label: 'não contém' },
    { value: 'is',           label: 'é exatamente' },
    { value: 'starts_with',  label: 'começa com'   },
  ],
  account_id: [
    { value: 'is',     label: 'é'    },
    { value: 'is_not', label: 'não é'},
  ],
  date: [
    { value: 'greater_than', label: 'após'  },
    { value: 'less_than',    label: 'antes' },
  ],
}

const ACTION_TYPES = [
  { value: 'set_category', label: 'Definir categoria'       },
  { value: 'rename_payee', label: 'Renomear pagador'        },
  { value: 'set_notes',    label: 'Definir notas'           },
  { value: 'set_cleared',  label: 'Marcar como conciliado'  },
  { value: 'flag_review',  label: 'Marcar para revisão'     },
]

const getOps = (field) => FIELD_OPS[field] || FIELD_OPS.payee_name

const RuleBuilder = ({ rule, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name:       rule?.name       || '',
    conditions: rule?.conditions || [],
    actions:    rule?.actions    || [],
    priority:   rule?.priority   ?? 0,
    is_active:  rule?.is_active  ?? true,
  })

  const addCondition = () => setForm(p => ({
    ...p,
    conditions: [...p.conditions, { field: 'payee_name', op: 'contains', value: '' }]
  }))

  const updateCondition = (i, patch) => setForm(p => ({
    ...p,
    conditions: p.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c)
  }))

  const removeCondition = (i) => setForm(p => ({
    ...p,
    conditions: p.conditions.filter((_, idx) => idx !== i)
  }))

  const addAction = () => setForm(p => ({
    ...p,
    actions: [...p.actions, { type: 'set_category', value: '' }]
  }))

  const updateAction = (i, patch) => setForm(p => ({
    ...p,
    actions: p.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a)
  }))

  const removeAction = (i) => setForm(p => ({
    ...p,
    actions: p.actions.filter((_, idx) => idx !== i)
  }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (form.conditions.length === 0) return
    onSave(form)
  }

  return (
    <form className="rule-builder" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>Nome da Regra *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Supermercado → Alimentação"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Prioridade</label>
          <input
            type="number"
            value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))}
          />
        </div>
        <div className="form-group rule-active-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            />
            Ativa
          </label>
        </div>
      </div>

      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Condições (todas devem ser verdadeiras)</h4>
          <button type="button" className="icon-btn sm" onClick={addCondition} title="Adicionar condição">
            <Plus size={14} />
          </button>
        </div>
        {form.conditions.map((c, i) => (
          <div key={i} className="rule-row">
            <select
              value={c.field}
              onChange={e => updateCondition(i, { field: e.target.value, op: getOps(e.target.value)[0].value })}
            >
              {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={c.op} onChange={e => updateCondition(i, { op: e.target.value })}>
              {getOps(c.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text"
              value={c.value}
              onChange={e => updateCondition(i, { value: e.target.value })}
              placeholder="valor"
            />
            <button type="button" className="icon-btn sm danger" onClick={() => removeCondition(i)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {form.conditions.length === 0 && (
          <p className="empty-text">Nenhuma condição. Clique em + para adicionar.</p>
        )}
      </div>

      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Ações</h4>
          <button type="button" className="icon-btn sm" onClick={addAction} title="Adicionar ação">
            <Plus size={14} />
          </button>
        </div>
        {form.actions.map((a, i) => (
          <div key={i} className="rule-row">
            <select value={a.type} onChange={e => updateAction(i, { type: e.target.value })}>
              {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              value={a.value}
              onChange={e => updateAction(i, { value: e.target.value })}
              placeholder={
                a.type === 'set_cleared' || a.type === 'flag_review' ? 'true ou false' : 'valor'
              }
            />
            <button type="button" className="icon-btn sm danger" onClick={() => removeAction(i)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {form.actions.length === 0 && (
          <p className="empty-text">Nenhuma ação. Clique em + para adicionar.</p>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="action-btn" onClick={onCancel}>
          <X size={14} /> Cancelar
        </button>
        <button type="submit" className="add-member-btn">
          <Check size={14} /> Salvar Regra
        </button>
      </div>
    </form>
  )
}

export default RuleBuilder
