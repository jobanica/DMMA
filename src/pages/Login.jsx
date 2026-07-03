import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Alert, Field, Spinner } from '../components/ui.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
    // On success, AuthProvider's onAuthStateChange re-renders into the app.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-800 to-slate-900 px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-700">DMMA Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Faculty time-in / time-out
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are provisioned by the HR / Dean’s office.
        </p>
      </div>
    </div>
  )
}
