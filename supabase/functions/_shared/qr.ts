// HMAC signing/verification for room QR tokens (spec §8).
//
// Token format:  <roomId>.<exp>.<sigHex>
//   roomId : room uuid
//   exp    : unix seconds after which the token is invalid, or 0 for a static
//            printed QR that never expires (Tier A). Rotating QR (Tier B) sets
//            a short exp.
//   sigHex : hex HMAC-SHA256 over "<roomId>.<exp>" keyed by the room qr_secret.
//
// The secret never leaves the server; validation always happens here.

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time-ish comparison to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signRoomToken(
  secret: string,
  roomId: string,
  expUnix = 0,
): Promise<string> {
  const payload = `${roomId}.${expUnix}`
  const sig = await hmacHex(secret, payload)
  return `${payload}.${sig}`
}

export type QrCheck =
  | { ok: true; roomId: string; exp: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

export async function verifyRoomToken(
  secret: string,
  token: string,
): Promise<QrCheck> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [roomId, expStr, sig] = parts
  const exp = Number(expStr)
  if (!roomId || Number.isNaN(exp)) return { ok: false, reason: 'malformed' }

  const expected = await hmacHex(secret, `${roomId}.${exp}`)
  if (!safeEqual(expected, sig)) return { ok: false, reason: 'bad_signature' }

  if (exp !== 0 && Date.now() / 1000 > exp) return { ok: false, reason: 'expired' }
  return { ok: true, roomId, exp }
}
