import { useEffect, useState } from 'react'
import { BookOpenText, Compass, Search } from 'lucide-react'
import { getQuickActionById } from '../../lib/tutorialCatalog.js'
import EmptyState from '../shared/EmptyState.jsx'
import PageActionBar from '../shared/PageActionBar.jsx'
import PageHeader from '../shared/PageHeader.jsx'
import TutorialCard from './TutorialCard.jsx'

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function TutorialsHub({
  tutorials = [],
  categories = [],
  completedTutorialIds = [],
  searchValue = '',
  onSearch,
  onOpenTutorial,
  onOpenQuickAction,
  onOpenTour,
}) {
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [localQuery, setLocalQuery] = useState(searchValue)

  useEffect(() => {
    setLocalQuery(searchValue)
  }, [searchValue])

  const allCategories = ['Todos', ...categories.filter(Boolean)]
  const normalizedQuery = normalizeText(localQuery)
  const filteredTutorials = tutorials.filter((tutorial) => {
    const matchesCategory = activeCategory === 'Todos' || tutorial.category === activeCategory
    const haystack = normalizeText([
      tutorial.title,
      tutorial.description,
      tutorial.category,
      tutorial.owner_module,
    ].join(' '))
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery)
    return matchesCategory && matchesQuery && !tutorial.deprecated
  })

  return (
    <div className="tutorials-hub">
      <PageHeader
        eyebrow="Ajuda operacional"
        title="Tutoriais"
        subtitle="Aprenda cada módulo no momento certo, sem transformar o produto em um wizard bloqueante."
        metrics={[
          { label: 'Guias ativos', value: String(tutorials.length) },
          { label: 'Concluídos', value: String(completedTutorialIds.length) },
          { label: 'Categorias', value: String(Math.max(categories.length, 1)) },
        ]}
      />

      <PageActionBar
        searchValue={localQuery}
        onSearch={(value) => {
          setLocalQuery(value)
          onSearch?.(value)
        }}
        searchPlaceholder="Buscar tutorial ou módulo"
        meta={`${filteredTutorials.length} ${filteredTutorials.length === 1 ? 'guia disponível' : 'guias disponíveis'}`}
        primaryAction={onOpenTour ? { label: 'Fazer tour rápido', onClick: onOpenTour } : null}
      >
        <div className="tutorials-hub__filters" role="tablist" aria-label="Categorias de tutoriais">
          {allCategories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              className={`tutorials-hub__filter ${activeCategory === category ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </PageActionBar>

      {filteredTutorials.length ? (
        <div className="tutorials-hub__grid">
          {filteredTutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              completed={completedTutorialIds.includes(tutorial.id)}
              quickActions={(tutorial.quickActionIds || [])
                .map((actionId) => getQuickActionById(actionId))
                .filter(Boolean)}
              onOpen={onOpenTutorial}
              onQuickAction={onOpenQuickAction}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Nenhum tutorial encontrado"
          description="A central de ajuda filtra os guias por contexto real de uso."
          detail="Ajuste a busca ou troque de categoria para encontrar o material mais útil para esta etapa."
          action={onOpenTour ? (
            <button type="button" className="empty-state__button" onClick={onOpenTour}>
              <Compass size={16} strokeWidth={1.75} />
              <span>Fazer tour rápido</span>
            </button>
          ) : (
            <button type="button" className="empty-state__button" onClick={() => setActiveCategory('Todos')}>
              <BookOpenText size={16} strokeWidth={1.75} />
              <span>Limpar filtros</span>
            </button>
          )}
        />
      )}
    </div>
  )
}
