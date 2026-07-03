import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

// Resolves the signed-in user into a role + profile:
//   role: 'admin' | 'super_admin' | 'teacher' | null
// plus the teacher record (with enrollment/consent status) when applicable.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [teacher, setTeacher] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (sess) => {
    if (!sess) {
      setRole(null)
      setTeacher(null)
      setDisplayName(null)
      return
    }
    // Check admin first.
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id, full_name, role')
      .eq('id', sess.user.id)
      .maybeSingle()

    if (adminRow) {
      setRole(adminRow.role)
      setTeacher(null)
      setDisplayName(adminRow.full_name)
      return
    }

    // Otherwise a teacher (non-sensitive columns only).
    const { data: t } = await supabase
      .from('teachers')
      .select('id, full_name, employee_id, department, enrolled_at, consent_at, active, must_change_password')
      .eq('auth_user_id', sess.user.id)
      .maybeSingle()

    setTeacher(t ?? null)
    setRole(t ? 'teacher' : null)
    setDisplayName(t?.full_name ?? null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      await loadProfile(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      // A password-reset email link signs the user in with a recovery session;
      // flag it so the app shows the reset-password screen instead of the app.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      await loadProfile(s)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshTeacher = useCallback(async () => {
    await loadProfile(session)
  }, [loadProfile, session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    role,
    teacher,
    displayName,
    loading,
    isEnrolled: !!(teacher?.enrolled_at && teacher?.consent_at),
    recovery,
    clearRecovery: () => setRecovery(false),
    refreshTeacher,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
