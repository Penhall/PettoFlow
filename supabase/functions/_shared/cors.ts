const DEFAULT_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'
const DEFAULT_HEADERS = 'Content-Type, X-Bot-Config-Key, X-Workspace-Key'

function getConfiguredOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_APP_ORIGIN')
    ?? Deno.env.get('APP_ORIGIN')
    ?? Deno.env.get('SITE_URL')
    ?? ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function originAllowed(requestOrigin: string, allowedOrigins: string[]): boolean {
  // Always allow Vercel deployment and preview URLs
  if (requestOrigin.endsWith('.vercel.app')) return true
  return allowedOrigins.some((pattern) => {
    if (pattern === '*') return true
    if (pattern.startsWith('*.')) return requestOrigin.endsWith(pattern.slice(1))
    return requestOrigin === pattern
  })
}

export function getCorsHeaders(req: Request, methods = DEFAULT_METHODS) {
  const requestOrigin = req.headers.get('origin')
  const allowedOrigins = getConfiguredOrigins()

  if (!requestOrigin || !originAllowed(requestOrigin, allowedOrigins)) {
    return null
  }

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': DEFAULT_HEADERS,
    'Vary': 'Origin',
  }
}

export function json(req: Request, data: unknown, status = 200) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

export function preflight(req: Request, methods = DEFAULT_METHODS) {
  const origin = req.headers.get('origin')
  if (!origin) {
    return new Response(null, { status: 204 })
  }

  const corsHeaders = getCorsHeaders(req, methods)
  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
