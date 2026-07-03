// Small shared UI primitives.

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="loading"
    />
  )
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      <Spinner className="mr-3 text-brand-700" />
      {label}
    </div>
  )
}

const STATUS_STYLES = {
  verified: 'bg-emerald-100 text-emerald-800',
  flagged: 'bg-amber-100 text-amber-800',
  override: 'bg-orange-100 text-orange-800',
  rejected: 'bg-rose-100 text-rose-800',
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  )
}

export function EventBadge({ type }) {
  return (
    <span
      className={`badge ${
        type === 'in' ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {type === 'in' ? 'TIME IN' : 'TIME OUT'}
    </span>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Alert({ tone = 'info', children }) {
  const tones = {
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
  )
}
