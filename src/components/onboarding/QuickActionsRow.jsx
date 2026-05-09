export default function QuickActionsRow({ actions = [] }) {
  if (!actions.length) {
    return null
  }

  return (
    <div className="quick-actions-row" role="group" aria-label="Ações rápidas">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="quick-actions-row__item"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
