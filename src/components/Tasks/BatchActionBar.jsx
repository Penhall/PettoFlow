export default function BatchActionBar({
  selectedCount,
  columns = [],
  teamMembers = [],
  onMoveToColumn,
  onAssign,
  onDelete,
  onClearSelection,
}) {
  return (
    <div className="batch-action-bar" role="region" aria-label="Ações em lote de tarefas">
      <div className="batch-action-bar__summary">
        {selectedCount} {selectedCount === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}
      </div>

      <div className="batch-action-bar__controls">
        <label className="batch-action-bar__field">
          <span>Mover para coluna</span>
          <select
            className="batch-action-bar__select"
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return
              onMoveToColumn?.(event.target.value)
              event.target.value = ''
            }}
          >
            <option value="" disabled>Selecionar</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>

        <label className="batch-action-bar__field">
          <span>Atribuir para</span>
          <select
            className="batch-action-bar__select"
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return
              onAssign?.(event.target.value)
              event.target.value = ''
            }}
          >
            <option value="" disabled>Selecionar</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="batch-action-bar__button batch-action-bar__button--danger"
          onClick={onDelete}
        >
          Excluir
        </button>
        <button
          type="button"
          className="batch-action-bar__button"
          onClick={onClearSelection}
        >
          Limpar seleção
        </button>
      </div>
    </div>
  )
}
