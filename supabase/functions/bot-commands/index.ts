import { json, preflight } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  return json(req, {
    error: 'A configuracao avancada do Telegram sera reestruturada para o modelo SaaS nas proximas fases.',
  }, 403)
})
