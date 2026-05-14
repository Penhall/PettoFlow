import { Component } from 'react'

const isDev = import.meta.env.DEV

export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] Shell-level crash caught:', error, info?.componentStack ?? '')
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error } = this.state
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')

    return (
      <div className="root-error-boundary" role="alert" aria-live="assertive">
        <div className="root-error-boundary__card">
          <span className="root-error-boundary__eyebrow">NexusCRM</span>
          <h1 className="root-error-boundary__title">Algo deu errado</h1>
          <p className="root-error-boundary__description">
            A interface encontrou um erro inesperado e não conseguiu se recuperar automaticamente.
          </p>
          <div className="root-error-boundary__actions">
            <button
              type="button"
              className="root-error-boundary__btn root-error-boundary__btn--primary"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </button>
            <button
              type="button"
              className="root-error-boundary__btn root-error-boundary__btn--secondary"
              onClick={this.handleReset}
            >
              Tentar novamente
            </button>
          </div>
          {isDev && (
            <details className="root-error-boundary__details">
              <summary>Detalhes do erro (desenvolvimento)</summary>
              <pre className="root-error-boundary__stack">{message}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
