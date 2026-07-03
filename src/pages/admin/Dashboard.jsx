import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { StatusBadge } from '../../components/ui.jsx'

// Live occupancy dashboard (spec §6.3). Reads the live_occupancy view and
// subscribes to attendance_logs changes via Supabase Realtime so the board
// updates as teachers scan in/out.
export default function Dashboard() {
  const [occupancy, setOccupancy] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('live_occupancy')
      .select('*')
      .order('room_code', { ascending: true })
    setOccupancy(data ?? [])
    setUpdatedAt(new Date())
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('occupancy')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  // Group occupants by room.
  const byRoom = occupancy.reduce((acc, r) => {
    (acc[r.room_code] ??= { building: r.building, people: [] }).people.push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Live occupancy</h1>
        <span className="text-xs text-slate-400">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ''}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Rooms occupied" value={Object.keys(byRoom).length} />
        <StatCard label="Teachers timed in" value={occupancy.length} />
        <StatCard
          label="Flagged now"
          value={occupancy.filter((o) => o.status === 'flagged').length}
        />
      </div>

      {Object.keys(byRoom).length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          No one is currently timed in.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(byRoom).map(([room, info]) => (
            <div key={room} className="card p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold">{room}</h2>
                <span className="text-xs text-slate-400">{info.building}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {info.people.map((p) => (
                  <li key={p.teacher_id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="font-medium">{p.full_name}</span>
                    <span className="text-slate-400">{p.employee_id}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      since {new Date(p.since).toLocaleTimeString()}
                    </span>
                    {p.status !== 'verified' && <StatusBadge status={p.status} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-brand-700">{value}</p>
    </div>
  )
}
