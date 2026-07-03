// Minimal inline icon set (stroke-based, currentColor) — avoids an icon dep.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const Icon = {
  grid: (p) => (
    <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
  ),
  list: (p) => (
    <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>
  ),
  flag: (p) => (
    <svg {...base} {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>
  ),
  users: (p) => (
    <svg {...base} {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4-4-4.5"/></svg>
  ),
  qr: (p) => (
    <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7M14 21h3"/></svg>
  ),
  calendar: (p) => (
    <svg {...base} {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
  ),
  chart: (p) => (
    <svg {...base} {...p}><path d="M4 20V4M4 20h16"/><rect x="7" y="11" width="3" height="6" rx="0.5"/><rect x="12" y="7" width="3" height="10" rx="0.5"/><rect x="17" y="13" width="3" height="4" rx="0.5"/></svg>
  ),
  logout: (p) => (
    <svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M4 12h11"/></svg>
  ),
  search: (p) => (
    <svg {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
  ),
  chevron: (p) => (
    <svg {...base} {...p}><path d="M6 9l6 6 6-6"/></svg>
  ),
  user: (p) => (
    <svg {...base} {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
  ),
  room: (p) => (
    <svg {...base} {...p}><path d="M3 21V7l9-4 9 4v14"/><path d="M3 21h18M9 21v-6h6v6"/></svg>
  ),
  clock: (p) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  ),
  check: (p) => (
    <svg {...base} {...p}><path d="M20 6L9 17l-5-5"/></svg>
  ),
  trendUp: (p) => (
    <svg {...base} {...p} strokeWidth="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
  ),
}
