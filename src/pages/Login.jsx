import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Alert, Field, Spinner } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'

// Login with show-password toggle, a forgot-password flow, and graceful
// handling of unconfirmed emails (all logins must confirm their email).
export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  async function signIn(e) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null); setNeedsConfirm(false)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (/confirm/i.test(error.message)) {
        setNeedsConfirm(true)
        setError('Please confirm your email before signing in. Check your inbox for the confirmation link.')
      } else {
        setError(error.message)
      }
    }
    setBusy(false)
  }

  async function resendConfirmation() {
    setBusy(true); setError(null); setInfo(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setInfo(error ? null : 'Confirmation email sent. Please check your inbox.')
    if (error) setError(error.message)
    setBusy(false)
  }

  async function sendReset(e) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setInfo('If an account exists for that email, a password-reset link is on its way. Check your inbox.')
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-800 to-slate-900 px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="DMMA seal" className="mx-auto mb-3 h-14 w-14 rounded-full" />
          <h1 className="text-xl font-bold text-brand-700">DMMA Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Faculty time-in / time-out</p>
        </div>

        {mode === 'signin' ? (
          <form onSubmit={signIn} className="space-y-4">
            <Field label="Email">
              <input type="email" autoComplete="username" className="input"
                     value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} autoComplete="current-password"
                       className="input pr-10" value={password}
                       onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600">
                  {showPw ? <Icon.eyeOff width={18} height={18} /> : <Icon.eye width={18} height={18} />}
                </button>
              </div>
            </Field>
            <div className="text-right">
              <button type="button" onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}
                      className="text-sm font-medium text-brand-600 hover:underline">
                Forgot password?
              </button>
            </div>
            {info && <Alert tone="success">{info}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            {needsConfirm && (
              <button type="button" className="btn-ghost w-full" onClick={resendConfirmation} disabled={busy}>
                Resend confirmation email
              </button>
            )}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Spinner /> : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter your email and we’ll send a link to reset your password.
            </p>
            <Field label="Email">
              <input type="email" autoComplete="username" className="input"
                     value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            {info && <Alert tone="success">{info}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Spinner /> : 'Send reset link'}
            </button>
            <button type="button" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}
                    className="w-full text-center text-sm font-medium text-brand-600 hover:underline">
              Back to sign in
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are provisioned by the HR / Dean’s office.
        </p>
      </div>
    </div>
  )
}
