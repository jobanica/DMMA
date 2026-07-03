// The room QR encodes the signed token string produced by the room-qr Edge
// Function: "<roomId>.<exp>.<sig>". The scanner reads that raw string; the
// server re-verifies the HMAC. The client only needs the roomId prefix for
// display, and never has the secret.
export function roomIdFromToken(token) {
  if (typeof token !== 'string') return null
  const id = token.split('.')[0]
  return id || null
}
