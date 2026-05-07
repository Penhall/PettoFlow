const FILTER_OPTIONS = [
  { type: 'task', label: 'Tarefas' },
  { type: 'activity', label: 'Atividades' },
  { type: 'receivable', label: 'A receber' },
  { type: 'transaction', label: 'Transacoes' },
]

export default function CalendarFilters({ active, onChange }) {
  return (
    <div className="calendar-filter-group" role="group" aria-label="Filtros do calendario">
      {FILTER_OPTIONS.map((option) => {
        const isActive = active.includes(option.type)

        return (
          <button
            key={option.type}
            type="button"
            className={`calendar-filter-chip ${isActive ? 'is-active' : ''}`}
            onClick={() => {
              const next = isActive
                ? active.filter((item) => item !== option.type)
                : [...active, option.type]

              if (next.length > 0) {
                onChange(next)
              }
            }}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
