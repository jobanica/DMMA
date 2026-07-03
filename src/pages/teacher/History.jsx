import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { EventBadge, StatusBadge } from '../../components/ui.jsx'

// A teacher's own attendance history with simple date/room filters. RLS ensures
// only the caller's rows are returned.
export default function History() {
  const { teacher } = useAuth()
  const [rows, setRows] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!teacher) return
    ;(async () => {
      let q = supabase
        .from('attendance_logs')
        .select('id, event_type, scanned_at, status, distance_m, face_match_score, room:rooms(room_code, building)')
        .eq('teacher_id', teacher.id)
        .order('scanned_at', { ascending: false })
        .limit(300)
      if (from) q = q.gte('scanned_at', new Date(from).toISOString())
      if (to) q = q.lte('scanned_at', new Date(to + 'T23:59:59').toISOString())
      const { data } = await q
      setRows(data ?? [])
    })()
  }, [teacher, from, to])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My attendance</h1>
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">From</span>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="label">To</span>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">When</th>
              <th className="p-3">Room</th>
              <th className="p-3">Event</th>
              <th className="p-3">Status</th>
              <th className="p-3">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-3 whitespace-nowrap">{new Date(r.scanned_at).toLocaleString()}</td>
                <td className="p-3 font-medium">{r.room?.room_code}</td>
                <td className="p-3"><EventBadge type={r.event_type} /></td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-slate-500">
                  {r.face_match_score != null ? r.face_match_score.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No records in range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
