import { Component, Fragment } from 'react'

const isDev = import.meta.env.DEV
const MAX_RETRIES = 3

export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] Shell-level crash caught:', error, info?.componentStack ?? '')
  }

  handleReset() {
    const { retryCount } = this.state
    if (retryCount >= MAX_RETRIES) {
      window.location.reload()
      return
    }
    // Increment retryCount — the key change on Fragment forces a full unmount
    // and remount of children, giving them a clean slate rather than re-throwing
    // immediately from the same component instance.
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state
      const exhausted = retryCount >= MAX_RETRIES
      const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')

      return (
        <div className="root-error-boundary" role="alert" aria-live="assertive">
          <div className="root-error-boundary__card">
            <span className="root-error-boundary__eyebrow">NexusCRM</span>
            <h1 className="root-error-boundary__title">Algo deu errado</h1>
            <p className="root-error-boundary__description">
              {exhausted
                ? 'O erro persiste após múltiplas tentativas. Recarregue a página para continuar.'
                : 'A interface encontrou um erro inesperado e não conseguiu se recuperar automaticamente.'}
            </p>
            <div className="root-error-boundary__actions">
              <button
                type="button"
                className="root-error-boundary__btn root-error-boundary__btn--primary"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
              {!exhausted && (
                <button
                  type="button"
                  className="root-error-boundary__btn root-error-boundary__btn--secondary"
                  onClick={this.handleReset}
                >
                  Tentar novamente
                </button>
              )}
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

    // Changing the key forces a full children unmount+remount on each successful
    // retry so the recovered subtree starts from a clean state.
    return (
      <Fragment key={this.state.retryCount}>
        {this.props.children}
      </Fragment>
    )
  }
}
