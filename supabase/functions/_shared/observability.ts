import { json } from './cors.ts'

type LogLevel = 'info' | 'warn' | 'error'

export function createRequestContext(req: Request, scope: string) {
  const requestId = req.headers.get('x-request-id')?.trim() || crypto.randomUUID()
  const url = new URL(req.url)
  const startedAt = Date.now()

  function log(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
    const payload = {
      level,
      event,
      scope,
      request_id: requestId,
      method: req.method,
      path: url.pathname,
      duration_ms: Date.now() - startedAt,
      ...metadata,
    }

    const line = JSON.stringify(payload)
    if (level === 'error') {
      console.error(line)
      return
    }

    if (level === 'warn') {
      console.warn(line)
      return
    }

    console.log(line)
  }

  function ok(data: unknown, status = 200) {
    return json(req, data, status, { 'X-Request-Id': requestId })
  }

  function fail(status: number, code: string, message: string, metadata: Record<string, unknown> = {}) {
    log(status >= 500 ? 'error' : 'warn', 'request_failed', {
      code,
      status,
      error: message,
      ...metadata,
    })

    return json(req, {
      error: message,
      code,
      request_id: requestId,
    }, status, { 'X-Request-Id': requestId })
  }

  return {
    requestId,
    scope,
    method: req.method,
    path: url.pathname,
    startedAt,
    log,
    ok,
    fail,
  }
}

export function attachRequestId(req: Request, requestId: string) {
  const headers = new Headers(req.headers)
  headers.set('x-request-id', requestId)
  return new Request(req, { headers })
}
