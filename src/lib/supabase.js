import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // Surface config errors loudly in dev instead of failing with cryptic 401s.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  )
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: { persistSession: true, autoRefreshToken: true },
})

// Invoke an Edge Function with the current user's access token attached.
export async function invokeFn(name, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw error
  return data
}
