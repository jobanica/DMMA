// Edge Function: create-teacher
// ---------------------------------------------------------------------------
// Admin-only. Provisions a teacher account in one step: creates the auth user
// with an admin-supplied temporary password (email pre-confirmed so they can
// log in immediately), then inserts the linked teachers row flagged
// `must_change_password` so the app forces a password change on first sign-in.
//
// Creating auth users needs the service role, so it must happen server-side —
// never from the browser. Returns 200 with { ok, ... } (ok:false for handled
// validation errors like a duplicate email) so the client can show a message.
//
// Request body: { employee_id, full_name, email, department?, password }
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return json({ ok: false, error: 'unauthenticated' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ ok: false, error: 'unauthenticated' }, 401)

  const { data: adminRow } = await admin
    .from('admins').select('id').eq('id', userData.user.id).maybeSingle()
  if (!adminRow) return json({ ok: false, error: 'forbidden' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }
  const employee_id = (body?.employee_id ?? '').trim()
  const full_name = (body?.full_name ?? '').trim()
  const email = (body?.email ?? '').trim().toLowerCase()
  const department = (body?.department ?? '').trim() || null
  const phone = (body?.phone ?? '').trim() || null
  const password = body?.password ?? ''

  if (!employee_id || !full_name || !email) return json({ ok: false, error: 'Employee ID, full name and email are required.' })
  if (typeof password !== 'string' || password.length < 8) return json({ ok: false, error: 'Temporary password must be at least 8 characters.' })

  // 1) Create the auth user (email pre-confirmed).
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr || !created?.user) {
    return json({ ok: false, error: authErr?.message ?? 'Could not create the login account.' })
  }
  const authUserId = created.user.id

  // 2) Insert the linked teacher row; roll back the auth user on failure.
  const { data: teacher, error: tErr } = await admin
    .from('teachers')
    .insert({
      employee_id, full_name, email, department, phone,
      auth_user_id: authUserId, must_change_password: true, active: true,
    })
    .select('id, employee_id, full_name, email, department, phone')
    .single()

  if (tErr) {
    await admin.auth.admin.deleteUser(authUserId)
    const dup = /duplicate|unique/i.test(tErr.message)
    return json({ ok: false, error: dup ? 'That employee ID or email already exists.' : tErr.message })
  }

  return json({ ok: true, teacher })
})
