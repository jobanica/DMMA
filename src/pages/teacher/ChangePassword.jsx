import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

// Teacher password change. Forced on first sign-in when the account was created
// with a temporary password (must_change_password), and also reachable anytime.
export default function ChangePassword() {
  const { user, teacher, isEnrolled, refreshTeacher } = useAuth()
  const forced = !!teacher?.must_change_password
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) return setError('Password must be at least 8 characters.')
    if (pw !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: pw })
      if (upErr) throw upErr
      // Clear the first-login flag on the teacher's own row (RLS: self update).
      if (teacher?.id) {
        await supabase.from('teachers').update({ must_change_password: false }).eq('id', teacher.id)
      }
      await refreshTeacher()
      navigate(isEnrolled ? '/' : '/enroll', { replace: true })
    } catch (err) {
      setError(err.message ?? 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">
        {forced ? 'Set your password' : 'Change password'}
      </h1>
      {forced && (
        <Alert tone="info">
          Your account was created with a temporary password. Please set a new
          password to continue.
        </Alert>
      )}
      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <p className="text-sm text-slate-500">Signed in as {user?.email}</p>
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" className="input"
                 value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        <Field label="Confirm new password">
          <input type="password" autoComplete="new-password" className="input"
                 value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Save password'}
        </button>
      </form>
    </div>
  )
}
