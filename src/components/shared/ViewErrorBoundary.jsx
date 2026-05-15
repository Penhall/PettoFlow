import { Component } from 'react'
import { traceAsyncFailure } from '../../lib/diagnostics.js'
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
    console.error('Erro ao renderizar area interna:', error)
    traceAsyncFailure('transition-failure', error, {
      areaLabel: this.props.areaLabel,
      resetKey: this.props.resetKey,
    })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    const { areaLabel = 'esta area', children } = this.props
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
                ? `Os modulos de ${areaLabel} ficaram desatualizados`
                : `Nao foi possivel carregar ${areaLabel}`
            }
            description={
              isChunkError
                ? 'O navegador manteve uma versao antiga do app enquanto esta area ja foi publicada em um novo bundle.'
                : 'A interface desta area encontrou um erro inesperado durante a renderizacao.'
            }
            detail={
              isChunkError
                ? 'Recarregue a pagina para buscar os modulos atualizados. Isso costuma acontecer logo apos um deploy novo.'
                : 'Tente abrir a area novamente. Se o problema persistir, atualize a pagina para recarregar os modulos internos.'
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
                {isChunkError ? 'Recarregar pagina' : 'Tentar novamente'}
              </button>
            )}
          />
        </SurfaceCard>
      )
    }

    return children
  }
}
