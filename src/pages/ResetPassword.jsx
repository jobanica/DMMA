import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Alert, Field, Spinner } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'

// Shown after a user follows a password-reset email link (recovery session).
export default function ResetPassword() {
  const { clearRecovery } = useAuth()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) return setError('Password must be at least 8 characters.')
    if (pw !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const { error: upErr } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (upErr) { setError(upErr.message); return }
    clearRecovery() // drop back into the app with the new password set
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-800 to-slate-900 px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="DMMA seal" className="mx-auto mb-3 h-14 w-14 rounded-full" />
          <h1 className="text-lg font-bold text-brand-700">Set a new password</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password" hint="At least 8 characters.">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
                     className="input pr-10" value={pw} onChange={(e) => setPw(e.target.value)} required />
              <button type="button" onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600">
                {showPw ? <Icon.eyeOff width={18} height={18} /> : <Icon.eye width={18} height={18} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password">
            <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
                   className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
