import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const teacherNav = [
  { to: '/', label: 'Home', end: true },
  { to: '/scan', label: 'Scan' },
  { to: '/history', label: 'History' },
]

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/logs', label: 'Logs' },
  { to: '/admin/review', label: 'Review' },
  { to: '/admin/teachers', label: 'Teachers' },
  { to: '/admin/rooms', label: 'Rooms & QR' },
  { to: '/admin/schedules', label: 'Schedules' },
  { to: '/admin/reports', label: 'Reports' },
]

export default function Layout({ children }) {
  const { role, signOut, user } = useAuth()
  const navigate = useNavigate()
  const nav = role === 'teacher' ? teacherNav : adminNav

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="font-bold text-brand-700">DMMA Attendance</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-500">
            {role}
          </span>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user?.email}</span>
            <button
              className="btn-ghost px-3 py-1.5 text-sm"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
