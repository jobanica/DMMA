// Data-privacy notice shown at enrollment (spec §10, RA 10173). Kept as a
// component so the same text can also appear in an admin-facing policy page.
export const PRIVACY_POLICY_VERSION =
  import.meta.env.VITE_PRIVACY_POLICY_VERSION ?? '2026-01'

export default function PrivacyNotice() {
  return (
    <div className="prose prose-sm max-w-none text-slate-700">
      <h3 className="font-semibold text-slate-900">
        Data Privacy Notice — Faculty Attendance (RA 10173)
      </h3>
      <p>
        DMMA College of Southern Philippines will collect a facial reference to
        verify your identity when you time in and out of classrooms.
      </p>
      <ul className="list-disc pl-5">
        <li>
          <strong>What we collect:</strong> a mathematical face template (a
          numeric descriptor) computed on your device. We do not need to keep
          your raw photo — the template cannot be turned back into your picture.
        </li>
        <li>
          <strong>Why:</strong> to confirm it is really you scanning, preventing
          proxy or buddy-punching, and to produce accurate attendance records for
          payroll and teaching-load verification.
        </li>
        <li>
          <strong>Where it is stored:</strong> securely in DMMA’s database with
          access restricted to authorized administrators only. Face data is never
          shared with other teachers or exposed to your app beyond enrollment.
        </li>
        <li>
          <strong>Your rights:</strong> you may request access to, correction of,
          or deletion of your biometric data. When you leave DMMA, your face data
          is deleted per the retention policy.
        </li>
      </ul>
      <p className="text-xs text-slate-500">Policy version: {PRIVACY_POLICY_VERSION}</p>
    </div>
  )
}
