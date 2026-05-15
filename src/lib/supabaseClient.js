import { createClient } from '@supabase/supabase-js'
import { getRuntimeFixtureSupabase, initializeRuntimeFixture, isRuntimeFixtureMode } from './runtimeFixture.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

if (isRuntimeFixtureMode()) {
  initializeRuntimeFixture()
}

export const supabase = isRuntimeFixtureMode()
  ? getRuntimeFixtureSupabase()
  : (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null
