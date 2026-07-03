import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { supabase, invokeFn } from '../../lib/supabase.js'
import { getPosition } from '../../lib/geo.js'
import { roomIdFromToken } from '../../lib/qrToken.js'
import face, {
  FACE_MATCH_THRESHOLD,
  FACE_MAX_ATTEMPTS,
  randomLivenessAction,
} from '../../lib/face/index.js'
import { Alert, EventBadge, Spinner, StatusBadge } from '../../components/ui.jsx'

// Scan flow (spec §6.2):
//   1. scan room QR (camera, back-facing)
//   2. active-liveness selfie + 1:1 face match against enrolled template
//   3. POST to record-scan Edge Function (server decides in/out + timestamp)
//   4. after N face failures, offer manual override (logged + flagged)
const STEPS = {
  QR: 'qr',
  FACE: 'face',
  SUBMIT: 'submit',
  RESULT: 'result',
}

const ACTION_LABEL = {
  blink: 'Please blink',
  'turn-left': 'Turn your head slightly LEFT',
  'turn-right': 'Turn your head slightly RIGHT',
  smile: 'Please smile',
}

export default function Scan() {
  const [step, setStep] = useState(STEPS.QR)
  const [qrToken, setQrToken] = useState(null)
  const [template, setTemplate] = useState(null)
  const [action, setAction] = useState(randomLivenessAction())
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState('') // human status line
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef(null)
  const qrControlsRef = useRef(null)

  // Load the enrolled template once (only the caller's own vector; §9/RPC).
  useEffect(() => {
    (async () => {
      await face.loadModels()
      const { data } = await supabase.rpc('get_my_face_template')
      setTemplate(data ?? null)
    })()
  }, [])

  // --- Step 1: QR scanning --------------------------------------------------
  const stopQr = useCallback(() => {
    qrControlsRef.current?.stop()
    qrControlsRef.current = null
  }, [])

  useEffect(() => {
    if (step !== STEPS.QR) return
    const reader = new BrowserQRCodeReader()
    let cancelled = false
    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (res, _err, controls) => {
        qrControlsRef.current = controls
        if (res && !cancelled) {
          cancelled = true
          const token = res.getText()
          controls.stop()
          onQrDecoded(token)
        }
      })
      .catch(() => setError('Could not start the camera for QR scanning.'))
    return () => {
      cancelled = true
      stopQr()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function onQrDecoded(token) {
    if (!roomIdFromToken(token)) {
      setError('That QR is not a valid room code. Scan the code posted in the room.')
      return
    }
    setQrToken(token)
    setError(null)
    setAction(randomLivenessAction())
    setStep(STEPS.FACE)
  }

  // --- Step 2: liveness + face match ---------------------------------------
  async function startFaceStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    return stream
  }

  async function runFaceCheck() {
    setBusy(true)
    setError(null)
    let stream
    try {
      stream = await startFaceStream()
      setStatus(ACTION_LABEL[action] + '…')
      const live = await face.detectAction(videoRef.current, action, { timeoutMs: 7000 })
      if (!live) {
        registerFailure('Liveness not detected. Follow the on-screen action and try again.')
        return
      }

      setStatus('Verifying your face…')
      const descriptor = await face.computeDescriptor(videoRef.current)
      if (!descriptor) {
        registerFailure('No clear face detected. Improve lighting and try again.')
        return
      }
      const score = face.matchScore(descriptor, template)
      const verified = 1 - score <= FACE_MATCH_THRESHOLD // distance <= threshold

      await submitScan({ score, verified, livenessPassed: true, override: false })
    } catch (e) {
      setError(e.message ?? 'Face check failed.')
    } finally {
      stream?.getTracks().forEach((t) => t.stop())
      setBusy(false)
    }
  }

  function registerFailure(msg) {
    setAttempts((n) => n + 1)
    setError(msg)
    setAction(randomLivenessAction())
  }

  async function overrideScan() {
    setBusy(true)
    setError(null)
    try {
      await submitScan({ score: null, verified: false, livenessPassed: false, override: true })
    } finally {
      setBusy(false)
    }
  }

  // --- Step 3: submit to server --------------------------------------------
  async function submitScan(faceResult) {
    setStep(STEPS.SUBMIT)
    setStatus('Recording…')
    const geo = await getPosition()
    try {
      const res = await invokeFn('record-scan', {
        qrToken,
        face: faceResult,
        geo: geo ? { latitude: geo.latitude, longitude: geo.longitude } : null,
        deviceInfo: { ua: navigator.userAgent },
      })
      setResult(res.event)
      setStep(STEPS.RESULT)
    } catch (e) {
      // Server rejected (bad QR, not enrolled, etc.) — back to face step.
      setError(serverError(e))
      setStep(STEPS.FACE)
    }
  }

  function reset() {
    setStep(STEPS.QR)
    setQrToken(null)
    setResult(null)
    setAttempts(0)
    setError(null)
    setStatus('')
  }

  const canOverride = attempts >= FACE_MAX_ATTEMPTS

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Scan</h1>

      {(step === STEPS.QR || step === STEPS.FACE) && (
        <div className="card overflow-hidden">
          <div className="bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
          <div className="space-y-3 p-4">
            {step === STEPS.QR && (
              <p className="text-sm text-slate-600">
                Point the camera at the room’s QR code.
              </p>
            )}
            {step === STEPS.FACE && (
              <>
                <div className="rounded-lg bg-brand-50 p-3 text-center text-sm font-medium text-brand-900">
                  {ACTION_LABEL[action]} — then hold still.
                </div>
                {status && <p className="text-center text-sm text-slate-500">{status}</p>}
                <button className="btn-primary w-full" onClick={runFaceCheck} disabled={busy || !template}>
                  {busy ? <Spinner /> : 'Verify & record'}
                </button>
                {!template && (
                  <Alert tone="warn">
                    No enrolled face template found. Complete enrollment first.
                  </Alert>
                )}
                {canOverride && (
                  <button className="btn-ghost w-full" onClick={overrideScan} disabled={busy}>
                    Can’t verify? Record with manual override (flagged for review)
                  </button>
                )}
                <p className="text-center text-xs text-slate-400">
                  Attempts: {attempts}/{FACE_MAX_ATTEMPTS}
                </p>
              </>
            )}
            {error && <Alert tone="error">{error}</Alert>}
          </div>
        </div>
      )}

      {step === STEPS.SUBMIT && (
        <div className="card flex flex-col items-center gap-3 p-8">
          <Spinner className="text-brand-700" />
          <p className="text-sm text-slate-600">{status}</p>
        </div>
      )}

      {step === STEPS.RESULT && result && (
        <div className="card space-y-3 p-6 text-center">
          <div className="text-4xl">
            {result.status === 'verified' ? '✅' : '⚠️'}
          </div>
          <div className="flex items-center justify-center gap-2">
            <EventBadge type={result.eventType} />
            <StatusBadge status={result.status} />
          </div>
          <h2 className="text-lg font-semibold">Room {result.roomCode}</h2>
          <p className="text-sm text-slate-600">
            {new Date(result.scannedAt).toLocaleString()}
          </p>
          {result.status !== 'verified' && (
            <Alert tone="warn">
              This scan was recorded but flagged for admin review
              {result.geoFlag ? ' (location looked far from the room).' : '.'}
            </Alert>
          )}
          <button className="btn-primary w-full" onClick={reset}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}

const SERVER_MESSAGES = {
  enrollment_required: 'You must complete enrollment before scanning.',
  invalid_qr: 'That room QR could not be verified. Ask admin to reprint it.',
  room_inactive: 'This room is not active.',
  unknown_room: 'Unknown room code.',
  not_a_teacher: 'Your account is not set up as a teacher.',
  inactive_teacher: 'Your account is inactive.',
}
function serverError(e) {
  const key = e?.context?.error || e?.message
  return SERVER_MESSAGES[key] ?? 'Scan could not be recorded. Please try again.'
}
