import { useCallback, useEffect, useRef, useState } from 'react'

// Manage a getUserMedia stream bound to a <video> ref. Front camera by default
// for selfies; caller passes facingMode: 'environment' for QR scanning.
export function useCamera({ facingMode = 'user' } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'camera_denied' : 'camera_error')
    }
  }, [facingMode])

  useEffect(() => stop, [stop])

  return { videoRef, ready, error, start, stop }
}
