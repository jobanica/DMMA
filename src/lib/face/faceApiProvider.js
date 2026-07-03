// On-device face provider backed by face-api.js / TensorFlow.js (spec §9).
// ---------------------------------------------------------------------------
// Cost & privacy: the template can stay on the phone; only a pass/fail + score
// leaves the device. Models are served from /public/models (see README).
//
// Matching is 1:1: the login already claims identity, so the live selfie only
// confirms it's the same person. We convert face-api's Euclidean distance to a
// 0..1 "closeness" score for storage/thresholding.
import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'
let loaded = false

export async function loadModels() {
  if (loaded) return
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
  ])
  loaded = true
}

const detectorOpts = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
})

// Returns a 128-float descriptor array, or null if no single clear face found.
export async function computeDescriptor(el) {
  const res = await faceapi
    .detectSingleFace(el, detectorOpts)
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!res) return null
  return Array.from(res.descriptor)
}

// Convert Euclidean distance to a 0..1 closeness score (1 = identical).
// distance 0 -> 1.0 ; distance 1.0 -> 0.0 (clamped).
export function matchScore(a, b) {
  if (!a || !b) return 0
  const dist = faceapi.euclideanDistance(a, b)
  return Math.max(0, Math.min(1, 1 - dist))
}

// Active liveness: sample the video for a few seconds and confirm the prompted
// action happened. Uses landmarks (eye aspect ratio / head yaw) and expressions.
export async function detectAction(video, action, { timeoutMs = 6000 } = {}) {
  const start = Date.now()
  let baselineYaw = null
  let sawClosedEye = false

  while (Date.now() - start < timeoutMs) {
    const res = await faceapi
      .detectSingleFace(video, detectorOpts)
      .withFaceLandmarks()
      .withFaceExpressions()

    if (res) {
      const lm = res.landmarks
      const yaw = headYaw(lm)
      if (baselineYaw === null) baselineYaw = yaw

      switch (action) {
        case 'blink': {
          const ear = eyeAspectRatio(lm)
          if (ear < 0.2) sawClosedEye = true
          if (sawClosedEye && ear > 0.28) return true // closed then reopened
          break
        }
        case 'turn-left':
          if (yaw - baselineYaw > 0.18) return true
          break
        case 'turn-right':
          if (baselineYaw - yaw > 0.18) return true
          break
        case 'smile':
          if ((res.expressions?.happy ?? 0) > 0.7) return true
          break
        default:
          return true
      }
    }
    await sleep(150)
  }
  return false
}

// --- landmark helpers ------------------------------------------------------
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Eye aspect ratio (average of both eyes); low value = closed.
function eyeAspectRatio(lm) {
  const le = lm.getLeftEye()
  const re = lm.getRightEye()
  return (singleEar(le) + singleEar(re)) / 2
}
function singleEar(e) {
  // 6-point eye: vertical over horizontal.
  const v = dist(e[1], e[5]) + dist(e[2], e[4])
  const h = 2 * dist(e[0], e[3])
  return h === 0 ? 0 : v / h
}

// Rough head yaw from nose position relative to eye centres. Positive = facing
// the camera's left (user turned their head one way).
function headYaw(lm) {
  const le = centroid(lm.getLeftEye())
  const re = centroid(lm.getRightEye())
  const nose = centroid(lm.getNose())
  const eyeMid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 }
  const eyeSpan = Math.abs(re.x - le.x) || 1
  return (nose.x - eyeMid.x) / eyeSpan
}
function centroid(pts) {
  const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: s.x / pts.length, y: s.y / pts.length }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export default { loadModels, computeDescriptor, matchScore, detectAction }
