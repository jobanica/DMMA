import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

// Teacher management (spec §6.3): CRUD + enrollment/consent status + a
// biometric-deletion action for RA 10173 retention/offboarding (spec §10).
export default function Teachers() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ employee_id: '', full_name: '', email: '', department: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, employee_id, full_name, email, department, enrolled_at, consent_at, active')
      .order('full_name')
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('teachers').insert(form)
    if (error) setMsg({ tone: 'error', text: error.message })
    else {
      setMsg({
        tone: 'success',
        text: 'Teacher record created. Invite them in Supabase Auth with the same email to enable login.',
      })
      setForm({ employee_id: '', full_name: '', email: '', department: '' })
      load()
    }
    setBusy(false)
  }

  async function toggleActive(t) {
    await supabase.from('teachers').update({ active: !t.active }).eq('id', t.id)
    load()
  }

  async function deleteBiometric(t) {
    if (!confirm(`Delete ${t.full_name}'s face template and reset enrollment? This is for RA 10173 offboarding and cannot be undone.`)) return
    await supabase
      .from('teachers')
      .update({ face_template: null, reference_face_path: null, enrolled_at: null })
      .eq('id', t.id)
    setMsg({ tone: 'success', text: `${t.full_name}'s biometric data deleted.` })
    load()
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Teachers</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <form onSubmit={create} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Employee ID">
          <input className="input" value={form.employee_id} onChange={set('employee_id')} required />
        </Field>
        <Field label="Full name">
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
        </Field>
        <Field label="Email">
          <input type="email" className="input" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Department">
          <input className="input" value={form.department} onChange={set('department')} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <button className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : 'Add teacher'}
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3">Name</th>
              <th className="p-3">Employee ID</th>
              <th className="p-3">Dept</th>
              <th className="p-3">Consent</th>
              <th className="p-3">Enrolled</th>
              <th className="p-3">Active</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="p-3 font-medium">{t.full_name}</td>
                <td className="p-3">{t.employee_id}</td>
                <td className="p-3 text-slate-500">{t.department ?? '—'}</td>
                <td className="p-3">{t.consent_at ? '✓' : '—'}</td>
                <td className="p-3">{t.enrolled_at ? '✓' : '—'}</td>
                <td className="p-3">
                  <button
                    className={`badge ${t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                    onClick={() => toggleActive(t)}
                  >
                    {t.active ? 'active' : 'inactive'}
                  </button>
                </td>
                <td className="p-3">
                  <button
                    className="text-xs font-medium text-rose-600 hover:underline"
                    onClick={() => deleteBiometric(t)}
                    disabled={!t.enrolled_at}
                  >
                    Delete biometric
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
