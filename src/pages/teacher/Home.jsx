import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { EventBadge, StatusBadge } from '../../components/ui.jsx'

// Teacher home: current status (are they timed in somewhere?) + quick scan CTA.
export default function Home() {
  const { teacher } = useAuth()
  const [openRooms, setOpenRooms] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    if (!teacher) return
    ;(async () => {
      const { data } = await supabase
        .from('attendance_logs')
        .select('id, event_type, scanned_at, status, room:rooms(room_code, building)')
        .eq('teacher_id', teacher.id)
        .order('scanned_at', { ascending: false })
        .limit(20)
      const rows = data ?? []
      setRecent(rows)

      // Compute currently-open rooms: latest event per room is 'in'.
      const latestPerRoom = new Map()
      for (const r of rows) {
        const key = r.room?.room_code ?? r.id
        if (!latestPerRoom.has(key)) latestPerRoom.set(key, r)
      }
      setOpenRooms([...latestPerRoom.values()].filter((r) => r.event_type === 'in'))
    })()
  }, [teacher])

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="text-sm text-slate-500">Welcome,</p>
        <h1 className="text-xl font-bold">{teacher?.full_name}</h1>
        <p className="text-sm text-slate-500">
          {teacher?.employee_id}
          {teacher?.department ? ` · ${teacher.department}` : ''}
        </p>

        {openRooms.length > 0 ? (
          <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
            You are currently <strong>timed in</strong> at{' '}
            {openRooms.map((r) => r.room?.room_code).join(', ')}. Scan again to
            time out.
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            You are not timed in anywhere. Scan a room QR to time in.
          </div>
        )}

        <Link to="/scan" className="btn-primary mt-4 w-full">
          Scan to Time In / Time Out
        </Link>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/history" className="text-sm text-brand-700">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No scans yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <EventBadge type={r.event_type} />
                <span className="font-medium">{r.room?.room_code}</span>
                <span className="text-slate-500">
                  {new Date(r.scanned_at).toLocaleString()}
                </span>
                <span className="ml-auto">
                  <StatusBadge status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
