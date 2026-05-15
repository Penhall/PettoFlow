import { Component } from 'react'
import { traceAsyncFailure } from '../../lib/diagnostics.js'
import { ACTION_TEXT, ERROR_TEXT } from '../../content/uxText.js'
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
                ? ERROR_TEXT.chunkTitle(areaLabel)
                : `Não foi possível carregar ${areaLabel}`
            }
            description={
              isChunkError
                ? ERROR_TEXT.chunkDescription
                : ERROR_TEXT.viewRender
            }
            detail={
              isChunkError
                ? ERROR_TEXT.chunkDetail
                : ERROR_TEXT.viewRetry
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
                {isChunkError ? ACTION_TEXT.reloadPage : ACTION_TEXT.retry}
              </button>
            )}
          />
        </SurfaceCard>
      )
    }

    return children
  }
}
