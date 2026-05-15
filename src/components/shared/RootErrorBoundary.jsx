import { Component, Fragment } from 'react'
import { traceAsyncFailure, traceRetryLifecycle } from '../../lib/diagnostics.js'
import { ACTION_TEXT, ERROR_TEXT, PRODUCT } from '../../content/uxText.js'

const isDev = import.meta.env.DEV
const MAX_RETRIES = 3

/**
 * Catches synchronous render failures in the React tree below this boundary.
 *
 * IMPORTANT — What this boundary does NOT catch:
 *  - Unhandled promise rejections (async code outside React render)
 *  - Errors thrown in event handlers (onClick, onChange, etc.)
 *  - Errors in setTimeout / setInterval callbacks
 *  - Errors in async lifecycle methods after they have returned
 *
 * For async/event failures this boundary installs a window.unhandledrejection
 * listener that logs and classifies them without attempting recovery.
 */
export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.handleReset = this.handleReset.bind(this)
    this._unhandledRejectionHandler = null
    this._errorHandler = null
  }

  componentDidMount() {
    if (typeof window === 'undefined') return
    this._unhandledRejectionHandler = (event) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'unknown')
      console.error(
        '[RootErrorBoundary] Unhandled async rejection (NOT caught by React EB):',
        msg,
        event.reason,
      )
      traceAsyncFailure('unhandled-rejection', event.reason, { component: 'RootErrorBoundary' })
    }
    this._errorHandler = (event) => {
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Erro assíncrono não tratado.')
      traceAsyncFailure('async-event', error, {
        component: 'RootErrorBoundary',
        filename: event.filename || null,
        lineno: event.lineno || null,
        colno: event.colno || null,
      })
    }
    window.addEventListener('unhandledrejection', this._unhandledRejectionHandler)
    window.addEventListener('error', this._errorHandler)
  }

  componentWillUnmount() {
    if (this._unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this._unhandledRejectionHandler)
    }
    if (this._errorHandler) {
      window.removeEventListener('error', this._errorHandler)
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] Shell-level crash caught:', error, info?.componentStack ?? '')
    traceAsyncFailure('transition-failure', error, {
      component: 'RootErrorBoundary',
      runtimePhase: typeof window !== 'undefined' ? window.__NEXUS_RUNTIME_PHASE__ ?? null : null,
      componentStack: info?.componentStack ?? null,
    })
  }

  handleReset() {
    const { retryCount } = this.state
    if (retryCount >= MAX_RETRIES) {
      traceRetryLifecycle('root-error-boundary', 'reload', {
        retryCount,
        runtimePhase: typeof window !== 'undefined' ? window.__NEXUS_RUNTIME_PHASE__ ?? null : null,
      })
      window.location.reload()
      return
    }
    traceRetryLifecycle('root-error-boundary', 'retry', {
      retryCount,
      runtimePhase: typeof window !== 'undefined' ? window.__NEXUS_RUNTIME_PHASE__ ?? null : null,
    })
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
            <span className="root-error-boundary__eyebrow">{PRODUCT.name}</span>
            <h1 className="root-error-boundary__title">{ERROR_TEXT.rootTitle}</h1>
            <p className="root-error-boundary__description">
              {exhausted
                ? ERROR_TEXT.rootExhausted
                : ERROR_TEXT.rootDescription}
            </p>
            <div className="root-error-boundary__actions">
              <button
                type="button"
                className="root-error-boundary__btn root-error-boundary__btn--primary"
                onClick={() => window.location.reload()}
              >
                {ACTION_TEXT.reloadPage}
              </button>
              {!exhausted && (
                <button
                  type="button"
                  className="root-error-boundary__btn root-error-boundary__btn--secondary"
                  onClick={this.handleReset}
                >
                  {ACTION_TEXT.retry}
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
