// supabase/functions/_shared/supabase.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

function getSupabaseUrl() {
  const url = Deno.env.get('SUPABASE_URL')!
  return url
}

function getServiceRoleKey() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return key
}

function getAnonKey() {
  const key = Deno.env.get('SUPABASE_ANON_KEY')!
  return key
}

export function getServiceRoleClient() {
  const url = getSupabaseUrl()
  const key = getServiceRoleKey()
  return createClient(url, key)
}

export function getSupabaseClient() {
  return getServiceRoleClient()
}

export function getUserSupabaseClient(req: Request) {
  const url = getSupabaseUrl()
  const key = getAnonKey()
  const authorization = req.headers.get('authorization') ?? ''

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  })
}
