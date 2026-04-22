import { getCorsHeaders } from './cors.ts'

export function workspaceAuthError(req: Request) {
  const corsHeaders = getCorsHeaders(req) ?? {}
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

export function requireWorkspaceAccess(req: Request) {
  const expected = Deno.env.get('WORKSPACE_ACCESS_SECRET') ?? ''
  const received = req.headers.get('x-workspace-key') ?? ''
  return expected.length > 0 && received === expected
}
