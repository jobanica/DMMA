import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Icon } from './icons.jsx'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: Icon.grid },
  { to: '/admin/logs', label: 'Logs', icon: Icon.list },
  { to: '/admin/review', label: 'Review', icon: Icon.flag },
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
      {/* Sidebar rail */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col items-center bg-navy-900 py-4 lg:w-20">
        <div className="mb-6 grid h-11 w-11 place-content-center rounded-xl bg-brand-500 text-sm font-black text-white shadow-lg">
          DM
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
              className={({ isActive }) =>
                `group relative grid h-11 w-11 place-content-center rounded-xl transition ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                }`
              }>
              <n.icon />
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                {n.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <button title="Sign out"
          onClick={async () => { await signOut(); navigate('/login') }}
          className="grid h-11 w-11 place-content-center rounded-xl text-navy-200 transition hover:bg-navy-800 hover:text-white">
          <Icon.logout />
        </button>
      </aside>

      {/* Main column */}
      <div className="pl-16 lg:pl-20">
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
