import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Alert, EventBadge, StatusBadge } from '../../components/ui.jsx'

// Review queue (spec §6.3): all flagged / override scans, approve or reject.
// Approving sets status -> 'verified'; rejecting -> 'rejected'. Both stamp
// reviewed_by / reviewed_at for the audit trail.
export default function ReviewQueue() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('attendance_logs')
      .select(
        'id, event_type, scanned_at, status, distance_m, face_match_score, liveness_passed, auto_closed, teacher:teachers(full_name, employee_id), room:rooms(room_code)',
      )
      .in('status', ['flagged', 'override'])
      .order('scanned_at', { ascending: false })
      .limit(200)
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function review(id, decision) {
    const { error } = await supabase
      .from('attendance_logs')
      .update({
        status: decision === 'approve' ? 'verified' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) setMsg({ tone: 'error', text: error.message })
    else {
      setMsg({ tone: 'success', text: `Scan ${decision === 'approve' ? 'approved' : 'rejected'}.` })
      load()
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Review queue</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          Nothing to review. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.teacher?.full_name}</span>
                  <span className="text-xs text-slate-400">{r.teacher?.employee_id}</span>
                  <EventBadge type={r.event_type} />
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Room {r.room?.room_code} · {new Date(r.scanned_at).toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">
                  match {r.face_match_score != null ? r.face_match_score.toFixed(2) : '—'} ·
                  liveness {r.liveness_passed ? '✓' : '✗'} ·
                  distance {r.distance_m ?? '—'}m
                  {r.auto_closed ? ' · auto-closed (estimated)' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => review(r.id, 'approve')}>
                  Approve
                </button>
                <button className="btn-ghost" onClick={() => review(r.id, 'reject')}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
