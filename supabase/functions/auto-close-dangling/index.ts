// Edge Function: auto-close-dangling  (spec §7, Phase 4)
// ---------------------------------------------------------------------------
// Scheduled (e.g. nightly via pg_cron / a Supabase scheduled trigger). Closes
// any 'in' event that was never matched by an 'out' by inserting a synthetic
// 'out' marked auto_closed = true, so reports show these as ESTIMATED, not
// verified, departures. Teachers forget to scan out; this keeps occupancy sane.
//
// "Open" means: for a (teacher, room), the most recent event is 'in' and it is
// older than the cutoff (default: before today, i.e. left dangling overnight).
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Everything scanned before the start of the current day is a candidate.
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)

  // Pull the latest event per (teacher, room) that is still 'in' before cutoff.
  // Done in SQL via an RPC for correctness; see migration 0002.
  const { data: dangling, error } = await admin.rpc('find_dangling_ins', {
    cutoff: cutoff.toISOString(),
  })
  if (error) return json({ error: 'query_failed', detail: error.message }, 500)

  if (!dangling || dangling.length === 0) return json({ ok: true, closed: 0 })

  const rows = dangling.map((d: any) => ({
    teacher_id: d.teacher_id,
    room_id: d.room_id,
    event_type: 'out',
    status: 'flagged', // estimated departure -> visible for review
    auto_closed: true,
    face_verified: false,
    liveness_passed: false,
  }))

  const { error: insErr } = await admin.from('attendance_logs').insert(rows)
  if (insErr) return json({ error: 'insert_failed', detail: insErr.message }, 500)

  return json({ ok: true, closed: rows.length })
})
