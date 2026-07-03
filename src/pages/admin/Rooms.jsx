import { useEffect, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase, invokeFn } from '../../lib/supabase.js'
import { Alert, Field, Spinner } from '../../components/ui.jsx'

// "Building · Floor N" line for the printable QR (omits blank parts).
function locationLine(room) {
  const parts = []
  if (room.building) parts.push(room.building)
  if (room.floor) parts.push(`Floor ${room.floor}`)
  return parts.join(' · ')
}

// Room & QR management (spec §6.3, §8): create rooms with coordinates, then
// generate a signed static QR (Tier A) and print it. The token is produced
// server-side by the room-qr Edge Function (secret never reaches the client).
export default function Rooms() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ room_code: '', building: '', floor: '', latitude: '', longitude: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [qr, setQr] = useState(null) // { room, dataUrl, token }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_code, building, floor, latitude, longitude, active')
      .order('room_code')
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const payload = {
      room_code: form.room_code,
      building: form.building || null,
      floor: form.floor || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    }
    const { error } = await supabase.from('rooms').insert(payload)
    if (error) setMsg({ tone: 'error', text: error.message })
    else {
      setForm({ room_code: '', building: '', floor: '', latitude: '', longitude: '' })
      load()
    }
    setBusy(false)
  }

  async function generateQr(room) {
    setMsg(null)
    try {
      // ttlSeconds omitted -> static Tier A token that never expires.
      const { token } = await invokeFn('room-qr', { roomId: room.id })
      const dataUrl = await QRCode.toDataURL(token, { width: 320, margin: 2 })
      setQr({ room, dataUrl, token })
    } catch (e) {
      setMsg({ tone: 'error', text: e.message ?? 'Could not generate QR.' })
    }
  }

  function printQr() {
    const w = window.open('', '_blank')
    if (!w) return
    const room = qr.room
    const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    const loc = locationLine(room)
    w.document.write(`
      <html><head><title>${esc(room.room_code)} QR</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:48px 24px;margin:0}
        h1{font-size:40px;margin:0 0 4px}
        .loc{font-size:20px;color:#334155;margin:0 0 24px}
        img{width:340px;height:340px}
        .foot{color:#64748b;font-size:13px;margin-top:20px}
      </style></head>
      <body>
        <h1>${esc(room.room_code)}</h1>
        ${loc ? `<p class="loc">${esc(loc)}</p>` : ''}
        <img src="${qr.dataUrl}" alt="Room QR" />
        <p class="foot">DMMA Attendance — scan to time in / out</p>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Rooms & QR</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <form onSubmit={create} className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Room code"><input className="input" value={form.room_code} onChange={set('room_code')} required /></Field>
        <Field label="Building"><input className="input" value={form.building} onChange={set('building')} /></Field>
        <Field label="Floor"><input className="input" value={form.floor} onChange={set('floor')} /></Field>
        <Field label="Latitude" hint="for geofence soft-flag"><input className="input" value={form.latitude} onChange={set('latitude')} /></Field>
        <Field label="Longitude"><input className="input" value={form.longitude} onChange={set('longitude')} /></Field>
        <div className="sm:col-span-3 lg:col-span-5">
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Add room'}</button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="p-3">Room</th><th className="p-3">Building</th>
                <th className="p-3">Coords</th><th className="p-3">Active</th><th className="p-3">QR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{r.room_code}</td>
                  <td className="p-3 text-slate-500">{r.building} {r.floor && `· ${r.floor}`}</td>
                  <td className="p-3 text-slate-500">
                    {r.latitude != null ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : '—'}
                  </td>
                  <td className="p-3">{r.active ? '✓' : '✗'}</td>
                  <td className="p-3">
                    <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => generateQr(r)}>
                      Generate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Printable QR</h2>
          {qr ? (
            <div className="text-center">
              <p className="text-lg font-bold text-navy-900">{qr.room.room_code}</p>
              {locationLine(qr.room) && (
                <p className="text-sm text-slate-500">{locationLine(qr.room)}</p>
              )}
              <img src={qr.dataUrl} alt="Room QR" className="mx-auto my-3 w-56" />
              <button className="btn-primary w-full" onClick={printQr}>Print</button>
              <p className="mt-2 break-all text-[10px] text-slate-400">{qr.token}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Select “Generate” on a room to produce its signed QR code.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
