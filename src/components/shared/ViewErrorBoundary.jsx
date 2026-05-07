import { Component } from 'react'
import EmptyState from './EmptyState.jsx'
import SurfaceCard from './SurfaceCard.jsx'

export default class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error) {
    console.error('Erro ao renderizar área interna:', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    const { areaLabel = 'esta área', children } = this.props
    const { error } = this.state

    if (this.state.hasError) {
      const message = error instanceof Error ? error.message : String(error || '')
      const isChunkError =
        /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
          .test(message)

      return (
        <SurfaceCard>
          <EmptyState
            title={
              isChunkError
                ? `Os módulos de ${areaLabel} ficaram desatualizados`
                : `Não foi possível carregar ${areaLabel}`
            }
            description={
              isChunkError
                ? 'O navegador manteve uma versão antiga do app enquanto esta área já foi publicada em um novo bundle.'
                : 'A interface desta área encontrou um erro inesperado durante a renderização.'
            }
            detail={
              isChunkError
                ? 'Recarregue a página para buscar os módulos atualizados. Isso costuma acontecer logo após um deploy novo.'
                : 'Tente abrir a área novamente. Se o problema persistir, atualize a página para recarregar os módulos internos.'
            }
            action={(
              <button
                type="button"
                className="page-action-bar__button page-action-bar__button--primary"
                onClick={() => {
                  if (isChunkError && typeof window !== 'undefined') {
                    window.location.reload()
                    return
                  }

                  this.setState({ hasError: false, error: null })
                }}
              >
                {isChunkError ? 'Recarregar página' : 'Tentar novamente'}
              </button>
            )}
          />
        </SurfaceCard>
      )
    }

    return children
  }
}
