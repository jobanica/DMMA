import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCamera } from '../../components/useCamera.js'
import { Alert, Spinner } from '../../components/ui.jsx'
import PrivacyNotice, { PRIVACY_POLICY_VERSION } from '../../components/PrivacyNotice.jsx'
import face from '../../lib/face/index.js'

// Enrollment (spec §6.1): consent → capture 1–3 reference selfies → compute
// and store a face template. A teacher cannot proceed to scanning until this
// completes. Consent is blocking (spec §10).
const SAMPLES_NEEDED = 3

export default function Enrollment() {
  const { refreshTeacher } = useAuth()
  const [step, setStep] = useState('consent') // consent | capture | done
  const [consented, setConsented] = useState(false)
  const [samples, setSamples] = useState([]) // array of descriptor arrays
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [modelsReady, setModelsReady] = useState(false)
  const { videoRef, ready, error: camError, start, stop } = useCamera({ facingMode: 'user' })

  function beginCapture() {
    setError(null)
    setStep('capture')
  }

  // Start the camera as soon as the capture step mounts (so the preview shows
  // immediately), then load the face models. A model-load failure surfaces an
  // error but never blocks the camera preview.
  useEffect(() => {
    if (step !== 'capture') return
    let cancelled = false
    ;(async () => {
      await start()
      try {
        await face.loadModels()
        if (!cancelled) setModelsReady(true)
      } catch {
        if (!cancelled) setError('Could not load the face models. Check your connection and reload the page.')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function captureSample() {
    setError(null)
    setBusy(true)
    try {
      const descriptor = await face.computeDescriptor(videoRef.current)
      if (!descriptor) {
        setError('No clear face detected — face the camera in good light and try again.')
      } else {
        setSamples((s) => [...s, descriptor])
      }
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      // Average the sample descriptors into one enrollment template.
      const template = averageDescriptors(samples)
      const { error: rpcErr } = await supabase.rpc('complete_enrollment', {
        p_template: template,
        p_policy_version: PRIVACY_POLICY_VERSION,
        p_ip_address: null,
      })
      if (rpcErr) throw rpcErr
      stop()
      setStep('done')
      await refreshTeacher()
    } catch (e) {
      setError(e.message ?? 'Enrollment failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Enrollment</h1>

      {step === 'consent' && (
        <div className="card space-y-4 p-5">
          <PrivacyNotice />
          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              I have read and understood this notice and I{' '}
              <strong>consent</strong> to DMMA collecting and processing my face
              template for attendance verification (policy {PRIVACY_POLICY_VERSION}).
            </span>
          </label>
          <button
            className="btn-primary w-full"
            disabled={!consented}
            onClick={beginCapture}
          >
            Continue to face capture
          </button>
        </div>
      )}

      {step === 'capture' && (
        <div className="card space-y-4 p-5">
          <p className="text-sm text-slate-600">
            Capture {SAMPLES_NEEDED} clear selfies in good, front-facing light.
            Captured: {samples.length}/{SAMPLES_NEEDED}
          </p>
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          {camError && (
            <Alert tone="error">
              {camError === 'camera_denied'
                ? 'Camera permission denied. Enable it in your browser settings.'
                : 'Could not access the camera.'}
            </Alert>
          )}
          {error && <Alert tone="warn">{error}</Alert>}
          {ready && !modelsReady && !error && (
            <p className="text-center text-sm text-slate-500">Loading face models…</p>
          )}
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={captureSample}
              disabled={!ready || !modelsReady || busy || samples.length >= SAMPLES_NEEDED}
            >
              {busy ? <Spinner /> : 'Capture selfie'}
            </button>
            <button
              className="btn-primary flex-1"
              onClick={finish}
              disabled={samples.length < SAMPLES_NEEDED || busy}
            >
              {busy ? <Spinner /> : 'Finish enrollment'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card space-y-3 p-5 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-semibold">Enrollment complete</h2>
          <p className="text-sm text-slate-600">
            You can now scan a room QR to time in and out.
          </p>
        </div>
      )}
    </div>
  )
}

// Element-wise mean of the 128-dim descriptors -> a single template vector.
function averageDescriptors(list) {
  if (list.length === 0) return null
  const len = list[0].length
  const out = new Array(len).fill(0)
  for (const d of list) for (let i = 0; i < len; i++) out[i] += d[i]
  return out.map((v) => v / list.length)
}
