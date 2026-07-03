import { useState } from 'react'

// Donut for a small categorical breakdown (e.g. today's scan status).
// Legend is always present (identity never by color alone); 2px gaps between
// segments; center shows the hovered slice or the total.
export function Donut({ data, size = 148, thickness = 16, gap = 3 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const [hover, setHover] = useState(null)
  let acc = 0

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                  className="text-slate-100" stroke="currentColor" strokeWidth={thickness} />
          {total > 0 && data.map((d, i) => {
            const frac = d.value / total
            const len = Math.max(0, frac * C - gap)
            const off = -acc * C
            acc += frac
            return (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                      stroke={d.color} strokeLinecap="butt"
                      strokeWidth={hover === i ? thickness + 4 : thickness}
                      strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off}
                      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                      style={{ transition: 'stroke-width .15s', cursor: 'pointer' }} />
            )
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="text-2xl font-bold text-slate-900">
            {hover != null ? data[hover].value : total}
          </div>
          <div className="text-[11px] text-slate-500">
            {hover != null ? data[hover].label : 'Total'}
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="truncate text-slate-600">{d.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Single-series magnitude-over-time bars. One hue (brand orange); the current
// period is emphasised, the rest are a recessive tint. No legend (one series).
export function BarChart({ data, highlightIndex, height = 190 }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const [hover, setHover] = useState(null)
  const plotH = height - 22

  return (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * plotH, d.value > 0 ? 3 : 0)
        const active = hover === i || (hover == null && highlightIndex === i)
        return (
          <div key={i}
               className="relative flex flex-1 flex-col items-center justify-end"
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-xs font-medium text-white shadow-lg">
                {d.value} scans
              </div>
            )}
            <div className="w-full rounded-t-[4px] transition-colors"
                 style={{ height: h, background: active ? '#E8611C' : '#F6D6BE' }} />
            <span className={`mt-1.5 text-[10px] ${active ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
