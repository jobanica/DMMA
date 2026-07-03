import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

// Reports & export (spec §6.3, Phase 4). Pulls logs for a pay period, computes
// late-arrival / early-departure flags against the schedule, and exports CSV.
export default function Reports() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function run() {
    if (!range.from || !range.to) {
      setMsg({ tone: 'warn', text: 'Pick a start and end date.' })
      return
    }
    setBusy(true)
    setMsg(null)

    const fromIso = new Date(range.from).toISOString()
    const toIso = new Date(range.to + 'T23:59:59').toISOString()

    const [{ data: logs }, { data: schedules }] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('id, event_type, scanned_at, status, teacher_id, room_id, teacher:teachers(full_name, employee_id), room:rooms(room_code)')
        .gte('scanned_at', fromIso)
        .lte('scanned_at', toIso)
        .order('scanned_at'),
      supabase.from('schedules').select('teacher_id, room_id, day_of_week, start_time, end_time'),
    ])

    const enriched = (logs ?? []).map((l) => {
      const flag = lateEarlyFlag(l, schedules ?? [])
      return {
        employee_id: l.teacher?.employee_id ?? '',
        teacher: l.teacher?.full_name ?? '',
        room: l.room?.room_code ?? '',
        event: l.event_type,
        server_time: new Date(l.scanned_at).toLocaleString(),
        status: l.status,
        schedule_flag: flag,
      }
    })

    setRows(enriched)
    setBusy(false)
    if (enriched.length === 0) setMsg({ tone: 'info', text: 'No records in this range.' })
  }

  function exportCsv() {
    const headers = ['employee_id', 'teacher', 'room', 'event', 'server_time', 'status', 'schedule_flag']
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(headers.map((h) => csvCell(r[h])).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dmma-attendance_${range.from}_to_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reports</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="Pay period start"><input type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="End"><input type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
        <button className="btn-primary" onClick={run} disabled={busy}>{busy ? <Spinner /> : 'Run report'}</button>
        <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">Employee</th><th className="p-3">Teacher</th><th className="p-3">Room</th>
              <th className="p-3">Event</th><th className="p-3">Server time</th><th className="p-3">Status</th><th className="p-3">Schedule</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="p-3">{r.employee_id}</td>
                <td className="p-3 font-medium">{r.teacher}</td>
                <td className="p-3">{r.room}</td>
                <td className="p-3">{r.event}</td>
                <td className="p-3 whitespace-nowrap">{r.server_time}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">
                  <span className={r.schedule_flag === 'on-time' ? 'text-emerald-600' : r.schedule_flag === '—' ? 'text-slate-400' : 'text-amber-600'}>
                    {r.schedule_flag}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Compare a scan against the teacher/room schedule for that weekday.
// 'in' after start_time -> "late Nm"; 'out' before end_time -> "early Nm".
function lateEarlyFlag(log, schedules) {
  const d = new Date(log.scanned_at)
  const dow = d.getDay()
  const match = schedules.find(
    (s) => s.teacher_id === log.teacher_id && s.room_id === log.room_id && s.day_of_week === dow,
  )
  if (!match) return '—'
  const minutes = d.getHours() * 60 + d.getMinutes()
  const [sh, sm] = match.start_time.split(':').map(Number)
  const [eh, em] = match.end_time.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em

  if (log.event_type === 'in') {
    const diff = minutes - startMin
    return diff > 5 ? `late ${diff}m` : 'on-time'
  }
  const diff = endMin - minutes
  return diff > 5 ? `early ${diff}m` : 'on-time'
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
