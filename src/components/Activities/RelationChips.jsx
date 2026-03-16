// src/components/Activities/RelationChips.jsx
import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'

const TYPE_COLORS = {
  client:   { bg: 'var(--chip-bg)', label: '🏢' },
  task:     { bg: 'var(--chip-bg)', label: '✅' },
  team:     { bg: 'var(--chip-bg)', label: '👤' },
}

const RelationChips = ({ value = [], onChange, clients = [], tasks = [], team = [] }) => {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)

  const allOptions = [
    ...clients.map(c => ({ type: 'client', id: String(c.id), label: c.name })),
    ...tasks.map(t => ({ type: 'task',   id: String(t.id), label: t.title })),
    ...team.map(m => ({ type: 'team',   id: String(m.id), label: m.name })),
  ]

  const filtered = search.trim()
    ? allOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) &&
        !value.some(v => v.type === o.type && v.id === o.id)
      ).slice(0, 6)
    : []

  const addChip = (option) => {
    onChange([...value, option])
    setSearch('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const removeChip = (index) => {
    onChange(value.filter((_, i) => i !== index))
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.relation-chips-wrapper')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relation-chips-wrapper">
      <div className="relation-chips">
        {value.map((chip, i) => (
          <span key={`${chip.type}-${chip.id}`} className="relation-chip">
            {TYPE_COLORS[chip.type]?.label || '🔗'} {chip.label}
            <button
              type="button"
              className="chip-remove"
              onClick={() => removeChip(i)}
              aria-label={`Remover ${chip.label}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="chip-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chip-input"
            placeholder={value.length === 0 ? 'Vincular a cliente, tarefa ou membro...' : 'Adicionar...'}
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => search && setShowDropdown(true)}
          />
        </div>
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="chip-dropdown">
          {filtered.map(opt => (
            <button
              key={`${opt.type}-${opt.id}`}
              type="button"
              className="chip-option"
              onClick={() => addChip(opt)}
            >
              {TYPE_COLORS[opt.type]?.label} {opt.label}
              <span className="chip-option-type">{opt.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default RelationChips
