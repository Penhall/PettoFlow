// src/components/Calendar/CalendarFilters.jsx
const FILTER_OPTIONS = [
  { type: 'task',        label: 'Tarefas',    color: '#3b82f6' },
  { type: 'activity',    label: 'Atividades', color: '#8b5cf6' },
  { type: 'receivable',  label: 'A Receber',  color: '#f59e0b' },
  { type: 'transaction', label: 'Transações', color: '#10b981' },
]

export default function CalendarFilters({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {FILTER_OPTIONS.map(opt => {
        const isActive = active.includes(opt.type)
        return (
          <button
            key={opt.type}
            onClick={() => {
              const next = isActive
                ? active.filter(t => t !== opt.type)
                : [...active, opt.type]
              if (next.length > 0) onChange(next)
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: `2px solid ${opt.color}`,
              background: isActive ? opt.color : 'transparent',
              color: isActive ? '#fff' : opt.color,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
