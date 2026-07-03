import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { StatusBadge, EventBadge } from '../../components/ui.jsx'
import { Icon } from '../../components/icons.jsx'
import { Donut, BarChart } from '../../components/charts.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CHART = { verified: '#2F9E44', flagged: '#E8611C', override: '#5B6AE5' }

export default function Dashboard() {
  const [teachers, setTeachers] = useState([])
  const [occupancy, setOccupancy] = useState([])
  const [recent, setRecent] = useState([])
  const [rooms, setRooms] = useState(0)
  const [statusToday, setStatusToday] = useState({ verified: 0, flagged: 0, override: 0 })
  const [monthly, setMonthly] = useState(MONTHS.map((m) => ({ label: m, value: 0 })))
  const [todaySchedule, setTodaySchedule] = useState([])
  const now = new Date()

  const load = useCallback(async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const [tRes, occRes, recentRes, roomRes, todayRes, yearRes, schedRes] = await Promise.all([
      supabase.from('teachers').select('id, full_name, email, department, enrolled_at').order('full_name'),
      supabase.from('live_occupancy').select('*'),
      supabase.from('attendance_logs').select('id, event_type, scanned_at, status, teacher:teachers(full_name), room:rooms(room_code)').order('scanned_at', { ascending: false }).limit(7),
      supabase.from('rooms').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_logs').select('status').gte('scanned_at', startOfDay.toISOString()),
      supabase.from('attendance_logs').select('scanned_at').gte('scanned_at', startOfYear.toISOString()),
      supabase.from('schedules').select('start_time, end_time, subject, teacher:teachers(full_name), room:rooms(room_code)').eq('day_of_week', now.getDay()).order('start_time'),
    ])

    setTeachers(tRes.data ?? [])
    setOccupancy(occRes.data ?? [])
    setRecent(recentRes.data ?? [])
    setRooms(roomRes.count ?? 0)

    const st = { verified: 0, flagged: 0, override: 0 }
    for (const r of todayRes.data ?? []) if (st[r.status] != null) st[r.status]++
    setStatusToday(st)

    const buckets = MONTHS.map((m) => ({ label: m, value: 0 }))
    for (const r of yearRes.data ?? []) buckets[new Date(r.scanned_at).getMonth()].value++
    setMonthly(buckets)

    setTodaySchedule(schedRes.data ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('dash')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const enrolled = teachers.filter((t) => t.enrolled_at).length
  const flaggedToday = statusToday.flagged + statusToday.override
  const donutData = [
    { label: 'Verified', value: statusToday.verified, color: CHART.verified },
    { label: 'Flagged', value: statusToday.flagged, color: CHART.flagged },
    { label: 'Override', value: statusToday.override, color: CHART.override },
  ]

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* MAIN */}
      <div className="space-y-5">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Icon.users} tint="brand" label="Total Teachers" value={teachers.length}
                sub={`${enrolled} enrolled`} />
          <Stat icon={Icon.clock} tint="moss" label="Timed In Now" value={occupancy.length}
                sub={`${new Set(occupancy.map((o) => o.room_code)).size} rooms active`} />
          <Stat icon={Icon.room} tint="navy" label="Rooms" value={rooms}
                sub="campus total" />
          <Stat icon={Icon.flag} tint="warn" label="Flagged Today" value={flaggedToday}
                sub="need review" />
        </div>

        {/* Flow + bar chart */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Scan status" subtitle="Today">
            {statusToday.verified + flaggedToday === 0 ? (
              <Empty>No scans recorded yet today.</Empty>
            ) : (
              <Donut data={donutData} />
            )}
          </Card>
          <Card title="Attendance activity" subtitle={String(now.getFullYear())}>
            <BarChart data={monthly} highlightIndex={now.getMonth()} />
          </Card>
        </div>

        {/* Tables */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Recent scans" action="Logs" to="/admin/logs">
            {recent.length === 0 ? <Empty>No activity yet.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="grid h-8 w-8 shrink-0 place-content-center rounded-full bg-navy-900 text-[11px] font-bold text-white">
                      {(r.teacher?.full_name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{r.teacher?.full_name ?? '—'}</p>
                      <p className="text-xs text-slate-400">{r.room?.room_code} · {new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <EventBadge type={r.event_type} />
                      <StatusBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Teachers" action="Manage" to="/admin/teachers">
            {teachers.length === 0 ? <Empty>No teachers yet — add them in Teachers.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {teachers.slice(0, 7).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="grid h-8 w-8 shrink-0 place-content-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                      {t.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{t.full_name}</p>
                      <p className="truncate text-xs text-slate-400">{maskEmail(t.email)}</p>
                    </div>
                    <span className="ml-auto text-xs text-slate-500">{t.department || '—'}</span>
                    {t.enrolled_at
                      ? <span className="badge bg-moss-100 text-moss-700">enrolled</span>
                      : <span className="badge bg-slate-100 text-slate-500">pending</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* RIGHT: today's agenda */}
      <aside className="card flex flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{DOW[now.getDay()]}</p>
            <p className="text-lg font-bold text-navy-900">
              {now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className="grid h-9 w-9 place-content-center rounded-lg bg-brand-50 text-brand-600">
            <Icon.calendar />
          </span>
        </div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Today’s schedule</p>
        {todaySchedule.length === 0 ? (
          <Empty>No classes scheduled for today.</Empty>
        ) : (
          <ul className="space-y-2.5">
            {todaySchedule.map((s, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                  <Icon.clock width={14} height={14} />
                  {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{s.subject || 'Class'}</p>
                <p className="text-xs text-slate-500">
                  {s.room?.room_code} · {s.teacher?.full_name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

// --- small presentational pieces -------------------------------------------
const TINTS = {
  brand: 'bg-brand-50 text-brand-600',
  moss: 'bg-moss-50 text-moss-600',
  navy: 'bg-navy-50 text-navy-600',
  warn: 'bg-amber-50 text-amber-600',
}

function Stat({ icon: I, label, value, sub, tint }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <span className={`grid h-10 w-10 place-content-center rounded-xl ${TINTS[tint]}`}><I /></span>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-navy-900">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function Card({ title, subtitle, action, to, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-navy-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action && <Link to={to} className="text-sm font-medium text-brand-600 hover:underline">{action}</Link>}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <div className="grid place-content-center py-8 text-center text-sm text-slate-400">{children}</div>
}

function maskEmail(email) {
  if (!email) return ''
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
}
