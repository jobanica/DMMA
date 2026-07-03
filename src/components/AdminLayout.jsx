import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Icon } from './icons.jsx'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: Icon.grid },
  { to: '/admin/logs', label: 'Attendance Logs', icon: Icon.list },
  { to: '/admin/review', label: 'Review Queue', icon: Icon.flag },
  { to: '/admin/teachers', label: 'Teachers', icon: Icon.users },
  { to: '/admin/rooms', label: 'Rooms & QR', icon: Icon.qr },
  { to: '/admin/schedules', label: 'Schedules', icon: Icon.calendar },
  { to: '/admin/reports', label: 'Reports', icon: Icon.chart },
]

function initials(name) {
  if (!name) return 'DM'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function AdminLayout({ children }) {
  const { displayName, user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar: icon-only rail on small screens, expanded with labels on md+ */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col bg-navy-900 py-4 md:w-60">
        {/* Brand: school seal + wordmark */}
        <div className="mb-6 flex items-center gap-3 px-3 md:px-5">
          <img
            src="/logo.png"
            alt="DMMA College of Southern Philippines seal"
            className="h-10 w-10 shrink-0 rounded-full bg-white object-contain ring-2 ring-white/20"
          />
          <div className="hidden leading-tight md:block">
            <p className="text-sm font-extrabold text-white">DMMA</p>
            <p className="text-[11px] text-navy-200">Attendance</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 md:px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition md:px-3 ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                }`
              }>
              <span className="grid h-6 w-6 shrink-0 place-content-center"><n.icon /></span>
              <span className="hidden text-sm font-medium md:block">{n.label}</span>
              {/* tooltip for the collapsed (mobile) rail */}
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block md:group-hover:hidden">
                {n.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <button title="Sign out"
          onClick={async () => { await signOut(); navigate('/login') }}
          className="mx-2 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-navy-200 transition hover:bg-navy-800 hover:text-white md:mx-3 md:px-3">
          <span className="grid h-6 w-6 shrink-0 place-content-center"><Icon.logout /></span>
          <span className="hidden text-sm font-medium md:block">Sign out</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="pl-16 md:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <h1 className="truncate text-lg font-extrabold uppercase tracking-tight text-navy-900 sm:text-xl">
            Hi, {displayName || 'Admin'}
          </h1>
          <div className="ml-auto hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 md:flex">
            <Icon.search width={16} height={16} />
            <input className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                   placeholder="Search…" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 sm:pr-3">
            <span className="grid h-8 w-8 place-content-center rounded-full bg-navy-900 text-xs font-bold text-white">
              {initials(displayName)}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-800">{displayName || 'Administrator'}</p>
              <p className="text-[11px] text-slate-400">{user?.email}</p>
            </div>
            <Icon.chevron width={16} height={16} className="hidden text-slate-400 sm:block" />
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
