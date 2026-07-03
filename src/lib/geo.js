// Read the device location once. Resolves to null on denial/timeout — the
// geofence is a soft signal (spec §8), so a missing fix must not block a scan.
export function getPosition({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    )
  })
}
