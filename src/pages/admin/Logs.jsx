import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { EventBadge, StatusBadge } from '../../components/ui.jsx'

// Attendance logs with filters by teacher / room / date range (spec §6.3).
export default function Logs() {
  const [rows, setRows] = useState([])
  const [teachers, setTeachers] = useState([])
  const [rooms, setRooms] = useState([])
  const [filters, setFilters] = useState({ teacher: '', room: '', from: '', to: '', status: '' })

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from('teachers').select('id, full_name').order('full_name'),
        supabase.from('rooms').select('id, room_code').order('room_code'),
      ])
      setTeachers(t ?? [])
      setRooms(r ?? [])
    })()
  }, [])

  useEffect(() => {
    (async () => {
      let q = supabase
        .from('attendance_logs')
        .select(
          'id, event_type, scanned_at, status, distance_m, face_match_score, liveness_passed, auto_closed, teacher:teachers(full_name), room:rooms(room_code)',
        )
        .order('scanned_at', { ascending: false })
        .limit(500)
      if (filters.teacher) q = q.eq('teacher_id', filters.teacher)
      if (filters.room) q = q.eq('room_id', filters.room)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.from) q = q.gte('scanned_at', new Date(filters.from).toISOString())
      if (filters.to) q = q.lte('scanned_at', new Date(filters.to + 'T23:59:59').toISOString())
      const { data } = await q
      setRows(data ?? [])
    })()
  }, [filters])

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Attendance logs</h1>

      <div className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <select className="input" value={filters.teacher} onChange={set('teacher')}>
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <select className="input" value={filters.room} onChange={set('room')}>
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.room_code}</option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={set('status')}>
          <option value="">Any status</option>
          {['verified', 'flagged', 'override', 'rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input type="date" className="input" value={filters.from} onChange={set('from')} />
        <input type="date" className="input" value={filters.to} onChange={set('to')} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">When (server)</th>
              <th className="p-3">Teacher</th>
              <th className="p-3">Room</th>
              <th className="p-3">Event</th>
              <th className="p-3">Match</th>
              <th className="p-3">Live</th>
              <th className="p-3">Dist (m)</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-3 whitespace-nowrap">{new Date(r.scanned_at).toLocaleString()}</td>
                <td className="p-3">{r.teacher?.full_name}</td>
                <td className="p-3 font-medium">{r.room?.room_code}</td>
                <td className="p-3">
                  <EventBadge type={r.event_type} />
                  {r.auto_closed && (
                    <span className="ml-1 text-xs text-slate-400">(auto)</span>
                  )}
                </td>
                <td className="p-3 text-slate-500">
                  {r.face_match_score != null ? r.face_match_score.toFixed(2) : '—'}
                </td>
                <td className="p-3 text-slate-500">{r.liveness_passed ? '✓' : '✗'}</td>
                <td className="p-3 text-slate-500">{r.distance_m ?? '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">No matching logs.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
