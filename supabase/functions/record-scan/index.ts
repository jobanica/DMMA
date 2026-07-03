// Edge Function: record-scan
// ---------------------------------------------------------------------------
// The single server-side entry point for a time-in/out scan (spec §6.2, §8, §9).
//
// It performs the checks that MUST NOT be trusted to the client:
//   * authenticate the caller and resolve their teacher record
//   * require completed enrollment + consent
//   * verify the room QR HMAC (and expiry for rotating QR)
//   * stamp the event with SERVER time (never the device clock)
//   * decide 'in' vs 'out' from the teacher's last open event in that room
//   * compute geofence distance as a SOFT flag (never a hard block)
//   * derive final status: verified | flagged | override
//
// Face matching itself runs on-device (face-api.js); the client sends the
// resulting score / verified / liveness booleans, which are recorded and
// factored into status. This keeps the face template on the phone (spec §9)
// while the authoritative event write stays server-side.
//
// Request body:
//   {
//     qrToken: string,
//     face: { score: number, verified: boolean, livenessPassed: boolean,
//             override?: boolean },
//     geo?: { latitude: number, longitude: number },
//     deviceInfo?: object
//   }
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { verifyRoomToken } from '../_shared/qr.ts'
import { distanceMeters } from '../_shared/geo.ts'

const GEOFENCE_FLAG_METERS = Number(Deno.env.get('GEOFENCE_FLAG_METERS') ?? '75')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'unauthenticated' }, 401)

  // Service-role client: bypasses RLS so we can read qr_secret / face_template
  // and insert the log. We authenticate the caller separately below.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'unauthenticated' }, 401)
  const authUserId = userData.user.id

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { qrToken, face, geo, deviceInfo } = body ?? {}
  if (typeof qrToken !== 'string' || !face) {
    return json({ error: 'missing_fields' }, 400)
  }

  // --- Resolve teacher & gate on enrollment + consent -----------------------
  const { data: teacher } = await admin
    .from('teachers')
    .select('id, active, enrolled_at, consent_at')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!teacher) return json({ error: 'not_a_teacher' }, 403)
  if (!teacher.active) return json({ error: 'inactive_teacher' }, 403)
  if (!teacher.enrolled_at || !teacher.consent_at) {
    return json({ error: 'enrollment_required' }, 403)
  }

  // --- Verify the room QR token (extract roomId from the signed payload) -----
  const roomId = qrToken.split('.')[0]
  const { data: room } = await admin
    .from('rooms')
    .select('id, room_code, latitude, longitude, qr_secret, active')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) return json({ error: 'unknown_room' }, 404)
  if (!room.active) return json({ error: 'room_inactive' }, 403)

  const qrCheck = await verifyRoomToken(room.qr_secret, qrToken)
  if (!qrCheck.ok) return json({ error: 'invalid_qr', reason: qrCheck.reason }, 403)

  // --- Geofence soft-flag ----------------------------------------------------
  let distance: number | null = null
  let geoFlag = false
  if (
    geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number' &&
    room.latitude != null && room.longitude != null
  ) {
    distance = distanceMeters(geo.latitude, geo.longitude, room.latitude, room.longitude)
    geoFlag = distance > GEOFENCE_FLAG_METERS
  }

  // --- Determine in vs out from the last event in THIS room ------------------
  const { data: lastEvent } = await admin
    .from('attendance_logs')
    .select('event_type')
    .eq('teacher_id', teacher.id)
    .eq('room_id', room.id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const eventType = lastEvent?.event_type === 'in' ? 'out' : 'in'

  // --- Derive status ---------------------------------------------------------
  const faceVerified = face.verified === true
  const livenessPassed = face.livenessPassed === true
  const isOverride = face.override === true

  let status: 'verified' | 'flagged' | 'override'
  if (isOverride || !faceVerified || !livenessPassed) {
    // A manual-override path or a soft face/liveness failure never strands a
    // genuine teacher — the event is logged but queued for admin review.
    status = isOverride ? 'override' : 'flagged'
  } else if (geoFlag) {
    status = 'flagged'
  } else {
    status = 'verified'
  }

  // --- Insert the authoritative log (scanned_at defaults to server now()) ----
  const { data: inserted, error: insErr } = await admin
    .from('attendance_logs')
    .insert({
      teacher_id: teacher.id,
      room_id: room.id,
      event_type: eventType,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      distance_m: distance,
      face_match_score: typeof face.score === 'number' ? face.score : null,
      face_verified: faceVerified,
      liveness_passed: livenessPassed,
      status,
      device_info: deviceInfo ?? null,
    })
    .select('id, event_type, scanned_at, status')
    .single()

  if (insErr) return json({ error: 'insert_failed', detail: insErr.message }, 500)

  return json({
    ok: true,
    event: {
      id: inserted.id,
      eventType: inserted.event_type,
      scannedAt: inserted.scanned_at,
      status: inserted.status,
      roomCode: room.room_code,
      distanceM: distance,
      geoFlag,
    },
  })
})
