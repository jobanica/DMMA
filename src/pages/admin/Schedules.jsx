import { useEffect, useState, useCallback } from 'react'
import { supabase, invokeFn } from '../../lib/supabase.js'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Schedule management per teacher/room/term (spec §6.3). Feeds the late/early
// flagging shown in Reports. Also supports AI import: scan a schedule photo or
// upload a CSV, and Claude extracts rows for the admin to review and import.
export default function Schedules() {
  const [rows, setRows] = useState([])
  const [teachers, setTeachers] = useState([])
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({
    teacher_id: '', room_id: '', day_of_week: '1',
    start_time: '08:00', end_time: '09:30', subject: '', term: '',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // AI import state
  const [importBusy, setImportBusy] = useState(false)
  const [importErr, setImportErr] = useState(null)
  const [preview, setPreview] = useState(null) // array of editable rows, or null

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('schedules')
      .select('id, day_of_week, start_time, end_time, subject, term, teacher:teachers(full_name), room:rooms(room_code)')
      .order('day_of_week')
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from('teachers').select('id, full_name').order('full_name'),
        supabase.from('rooms').select('id, room_code').order('room_code'),
      ])
      setTeachers(t ?? [])
      setRooms(r ?? [])
    })()
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('schedules').insert({
      ...form,
      day_of_week: Number(form.day_of_week),
    })
    if (error) setMsg({ tone: 'error', text: error.message })
    else {
      setForm((f) => ({ ...f, subject: '' }))
      load()
    }
    setBusy(false)
  }

  async function remove(id) {
    await supabase.from('schedules').delete().eq('id', id)
    load()
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // --- AI import ------------------------------------------------------------
  const matchRoomId = (code) => {
    if (!code) return ''
    const c = code.trim().toLowerCase()
    const hit = rooms.find((x) => x.room_code.toLowerCase() === c) ||
      rooms.find((x) => x.room_code.toLowerCase().replace(/\s/g, '') === c.replace(/\s/g, ''))
    return hit?.id ?? ''
  }
  const matchTeacherId = (name) => {
    if (!name) return ''
    const n = name.trim().toLowerCase()
    const hit = teachers.find((x) => x.full_name.toLowerCase() === n) ||
      teachers.find((x) => x.full_name.toLowerCase().includes(n) || n.includes(x.full_name.toLowerCase()))
    return hit?.id ?? ''
  }

  async function runParse(payload) {
    setImportBusy(true); setImportErr(null); setPreview(null)
    try {
      const res = await invokeFn('parse-schedule', {
        ...payload,
        teachers: teachers.map((t) => t.full_name),
        rooms: rooms.map((r) => r.room_code),
      })
      if (!res?.ok) { setImportErr(res?.error ?? 'Could not read the schedule.'); return }
      const rows = (res.rows ?? []).map((r) => ({
        include: true,
        teacher_id: matchTeacherId(r.teacher),
        room_id: matchRoomId(r.room_code),
        day_of_week: Number.isInteger(r.day_of_week) ? r.day_of_week : 1,
        start_time: String(r.start_time || '08:00').slice(0, 5),
        end_time: String(r.end_time || '09:00').slice(0, 5),
        subject: r.subject || '',
        term: r.term || '',
        rawTeacher: r.teacher || '',
        rawRoom: r.room_code || '',
      }))
      if (rows.length === 0) setImportErr('No classes were found in that file.')
      else setPreview(rows)
    } catch (e) {
      setImportErr(e.message ?? 'Could not read the schedule.')
    } finally {
      setImportBusy(false)
    }
  }

  async function onImageFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const b64 = await fileToBase64(f)
    runParse({ imageBase64: b64, mimeType: f.type })
  }
  async function onCsvFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    runParse({ csv: await f.text() })
  }

  const editRow = (i, k, v) => setPreview((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)))

  async function importAll() {
    const toInsert = preview
      .filter((p) => p.include && p.teacher_id && p.room_id)
      .map((p) => ({
        teacher_id: p.teacher_id, room_id: p.room_id, day_of_week: p.day_of_week,
        start_time: p.start_time, end_time: p.end_time,
        subject: p.subject || null, term: p.term || null,
      }))
    if (toInsert.length === 0) {
      setMsg({ tone: 'warn', text: 'Nothing to import — match a teacher and room for at least one row.' })
      return
    }
    const { error } = await supabase.from('schedules').insert(toInsert)
    if (error) setMsg({ tone: 'error', text: error.message })
    else {
      setMsg({ tone: 'success', text: `Imported ${toInsert.length} schedule${toInsert.length > 1 ? 's' : ''}.` })
      setPreview(null)
      load()
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Schedules</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* AI import */}
      <div className="card space-y-3 p-4">
        <div>
          <h2 className="font-semibold text-navy-900">Import with AI</h2>
          <p className="text-sm text-slate-500">
            Scan a photo of a printed schedule or upload a CSV — Claude extracts the rows for you to review before saving.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-ghost cursor-pointer">
            Scan image
            <input type="file" accept="image/*" capture="environment" className="hidden"
                   onChange={onImageFile} disabled={importBusy} />
          </label>
          <label className="btn-ghost cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden"
                   onChange={onCsvFile} disabled={importBusy} />
          </label>
          {importBusy && (
            <span className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Reading schedule…</span>
          )}
        </div>
        {importErr && <Alert tone="error">{importErr}</Alert>}
      </div>

      {/* Review extracted rows */}
      {preview && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-navy-900">Review extracted schedule ({preview.length})</h2>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setPreview(null)}>Discard</button>
              <button className="btn-primary" onClick={importAll}>Import selected</button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Highlighted rows need a teacher or room matched. Adjust anything, untick to skip, then Import.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="p-2"></th><th className="p-2">Teacher</th><th className="p-2">Room</th>
                  <th className="p-2">Day</th><th className="p-2">Start</th><th className="p-2">End</th>
                  <th className="p-2">Subject</th><th className="p-2">Term</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${(!p.teacher_id || !p.room_id) ? 'bg-amber-50' : ''}`}>
                    <td className="p-2">
                      <input type="checkbox" checked={p.include} onChange={(e) => editRow(i, 'include', e.target.checked)} />
                    </td>
                    <td className="p-2">
                      <select className="input py-1" value={p.teacher_id} onChange={(e) => editRow(i, 'teacher_id', e.target.value)}>
                        <option value="">— {p.rawTeacher || 'match'} —</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="input py-1" value={p.room_id} onChange={(e) => editRow(i, 'room_id', e.target.value)}>
                        <option value="">— {p.rawRoom || 'match'} —</option>
                        {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="input py-1" value={p.day_of_week} onChange={(e) => editRow(i, 'day_of_week', Number(e.target.value))}>
                        {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="time" className="input py-1" value={p.start_time} onChange={(e) => editRow(i, 'start_time', e.target.value)} /></td>
                    <td className="p-2"><input type="time" className="input py-1" value={p.end_time} onChange={(e) => editRow(i, 'end_time', e.target.value)} /></td>
                    <td className="p-2"><input className="input py-1" value={p.subject} onChange={(e) => editRow(i, 'subject', e.target.value)} /></td>
                    <td className="p-2"><input className="input py-1" value={p.term} onChange={(e) => editRow(i, 'term', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form onSubmit={create} className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Teacher">
          <select className="input" value={form.teacher_id} onChange={set('teacher_id')} required>
            <option value="">Select…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </Field>
        <Field label="Room">
          <select className="input" value={form.room_id} onChange={set('room_id')} required>
            <option value="">Select…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}
          </select>
        </Field>
        <Field label="Day">
          <select className="input" value={form.day_of_week} onChange={set('day_of_week')}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Term"><input className="input" value={form.term} onChange={set('term')} placeholder="2025-2026 2nd Sem" /></Field>
        <Field label="Start"><input type="time" className="input" value={form.start_time} onChange={set('start_time')} /></Field>
        <Field label="End"><input type="time" className="input" value={form.end_time} onChange={set('end_time')} /></Field>
        <Field label="Subject"><input className="input" value={form.subject} onChange={set('subject')} /></Field>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Add'}</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">Teacher</th><th className="p-3">Room</th><th className="p-3">Day</th>
              <th className="p-3">Time</th><th className="p-3">Subject</th><th className="p-3">Term</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="p-3">{s.teacher?.full_name}</td>
                <td className="p-3 font-medium">{s.room?.room_code}</td>
                <td className="p-3">{DAYS[s.day_of_week]}</td>
                <td className="p-3">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</td>
                <td className="p-3 text-slate-500">{s.subject ?? '—'}</td>
                <td className="p-3 text-slate-500">{s.term ?? '—'}</td>
                <td className="p-3">
                  <button className="text-xs text-rose-600 hover:underline" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
