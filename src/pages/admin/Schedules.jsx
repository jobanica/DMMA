import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Schedule management per teacher/room/term (spec §6.3). Feeds the late/early
// flagging shown in Reports.
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Schedules</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

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
