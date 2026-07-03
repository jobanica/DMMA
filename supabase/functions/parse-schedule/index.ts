// Edge Function: parse-schedule
// ---------------------------------------------------------------------------
// Admin-only. Uses Claude (claude-opus-4-8) to turn a photographed schedule
// (vision) or an uploaded CSV into structured schedule rows the admin can
// review and import. The Anthropic API key stays server-side.
//
// Request body (one of image / csv):
//   { imageBase64: string, mimeType: string, teachers?: string[], rooms?: string[] }
//   { csv: string,          teachers?: string[], rooms?: string[] }
// Response: { ok: true, rows: [...] } | { ok: false, error }
// ---------------------------------------------------------------------------
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.68.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const SYSTEM = `You convert a faculty class schedule (given as an image or CSV) into structured JSON.
Output ONLY a JSON object — no prose, no markdown fences — of exactly this shape:
{"rows":[{"day_of_week":<int 0-6>,"start_time":"HH:MM","end_time":"HH:MM","subject":"<string>","room_code":"<string>","teacher":"<string>","term":"<string>"}]}

Rules:
- day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.
- Times are 24-hour HH:MM (e.g. "08:00", "13:30").
- Output one row per (day, class). If a class meets several days (e.g. "MWF 8:00-9:00"), output one row per day.
- room_code: prefer an exact match to one of the KNOWN ROOMS; otherwise use what is written.
- teacher: prefer an exact match to one of the KNOWN TEACHERS; otherwise use what is written.
- term: the semester/term label if present, else "".
- If a field is genuinely unknown, use an empty string. Never invent classes that are not in the source.`

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
  const { data: adminRow } = await admin.from('admins').select('id').eq('id', userData.user.id).maybeSingle()
  if (!adminRow) return json({ ok: false, error: 'forbidden' }, 403)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ ok: false, error: 'AI is not configured yet. An admin must set the ANTHROPIC_API_KEY secret.' })

  let body: any
  try { body = await req.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }
  const { imageBase64, mimeType, csv, teachers = [], rooms = [] } = body ?? {}

  const context =
    `KNOWN ROOMS: ${rooms.length ? rooms.join(', ') : '(none)'}\n` +
    `KNOWN TEACHERS: ${teachers.length ? teachers.join(', ') : '(none)'}\n\n` +
    `Extract the class schedule as JSON.`

  let content: any
  if (typeof imageBase64 === 'string' && imageBase64) {
    const mt = /^image\/(png|jpe?g|gif|webp)$/.test(mimeType) ? mimeType.replace('image/jpg', 'image/jpeg') : 'image/jpeg'
    content = [
      { type: 'image', source: { type: 'base64', media_type: mt, data: imageBase64 } },
      { type: 'text', text: context },
    ]
  } else if (typeof csv === 'string' && csv.trim()) {
    content = [{ type: 'text', text: `${context}\n\nCSV:\n${csv}` }]
  } else {
    return json({ ok: false, error: 'Provide an image or a CSV.' }, 400)
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const text = (msg.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const jsonText = extractJson(text)
    const parsed = JSON.parse(jsonText)
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : []
    return json({ ok: true, rows })
  } catch (e) {
    return json({ ok: false, error: e?.message ?? 'AI extraction failed.' })
  }
})

// Pull the first {...} JSON object out of a response (defensive against fences).
function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : '{"rows":[]}'
}
