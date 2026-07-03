// Edge Function: room-qr
// ---------------------------------------------------------------------------
// Admin-only. Returns a signed QR token for a room so it can be rendered and
// printed (spec §6.3 Room & QR management, §8).
//
//   Tier A (default): ttlSeconds omitted / 0 -> static token, never expires.
//   Tier B (upgrade): ttlSeconds > 0 -> short-lived rotating token; the room
//                     display re-requests one every ~15-30s.
//
// Request body: { roomId: string, ttlSeconds?: number }
// Response:     { token, expiresAt }
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { signRoomToken } from '../_shared/qr.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return json({ error: 'unauthenticated' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'unauthenticated' }, 401)

  // Gate on admin role.
  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (!adminRow) return json({ error: 'forbidden' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { roomId, ttlSeconds } = body ?? {}
  if (typeof roomId !== 'string') return json({ error: 'missing_room' }, 400)

  const { data: room } = await admin
    .from('rooms')
    .select('id, qr_secret')
    .eq('id', roomId)
    .maybeSingle()
  if (!room) return json({ error: 'unknown_room' }, 404)

  const ttl = Number(ttlSeconds) > 0 ? Number(ttlSeconds) : 0
  const exp = ttl > 0 ? Math.floor(Date.now() / 1000) + ttl : 0
  const signed = await signRoomToken(room.qr_secret, room.id, exp)

  return json({ token: signed, expiresAt: exp === 0 ? null : exp })
})
