// Face-verification service interface (spec §9).
// ---------------------------------------------------------------------------
// The scan flow talks ONLY to this module, never to face-api.js directly, so
// the on-device matcher can later be swapped for a hosted API without touching
// the scan UI. Every provider must implement:
//
//   loadModels()                          -> Promise<void>
//   computeDescriptor(videoOrImageEl)     -> Promise<number[] | null>
//   matchScore(descriptorA, descriptorB)  -> number   (0..1, higher = closer)
//   detectAction(videoEl, action, opts)   -> Promise<boolean>   (liveness)
//
// The default export is the active provider. Change this import to switch.
import faceApiProvider from './faceApiProvider.js'

const provider = faceApiProvider

export const LIVENESS_ACTIONS = ['blink', 'turn-left', 'turn-right', 'smile']

// Pick a random liveness action for the scan prompt (active liveness, §9).
export function randomLivenessAction() {
  return LIVENESS_ACTIONS[Math.floor(Math.random() * LIVENESS_ACTIONS.length)]
}

export const FACE_MATCH_THRESHOLD = Number(
  import.meta.env.VITE_FACE_MATCH_THRESHOLD ?? 0.55,
)
export const FACE_MAX_ATTEMPTS = Number(
  import.meta.env.VITE_FACE_MAX_ATTEMPTS ?? 3,
)

export default provider
