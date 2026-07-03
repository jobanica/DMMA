# DMMA Teacher Attendance System

QR + face-verified faculty time-in/time-out, built as an installable PWA with a
Supabase backend, plus an admin monitoring dashboard. Replaces DMMA College of
Southern Philippines' manual paper-logsheet attendance.

Every scan is a **three-factor proof** (spec §3):

1. **Right room** — a signed room QR code (HMAC, verified server-side).
2. **Right account** — the teacher's app login.
3. **Right person** — a live 1:1 face check against the enrolled template, with
   active liveness (blink / head-turn / smile).

All timestamps are set **server-side** — the device clock is never trusted.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TailwindCSS, installable **PWA** |
| Camera / QR | `getUserMedia` + `@zxing/browser` |
| Face match | on-device **face-api.js** (TensorFlow.js), 1:1, behind a swappable interface |
| Backend | **Supabase** — Postgres + RLS, Auth, Storage, Realtime, Edge Functions |
| Server logic | Deno Edge Functions: QR HMAC validation, scan recording, QR minting, end-of-day auto-close |

Key architectural decisions (spec §13) are already made: static signed QR by
default (rotating QR is an optional upgrade), on-device face-api.js with active
liveness, server-only timestamps, geofence as a soft flag (never a hard block),
a manual-override path so a failed face check never strands a real teacher, and
RA 10173 consent + template-over-raw-image storage.

---

## Project layout

```
supabase/
  migrations/0001_init.sql        schema + RLS + storage bucket
  migrations/0002_rpc_and_views.sql  enrollment RPC, dangling-in finder, live_occupancy view
  functions/record-scan/          THE scan endpoint (QR verify, in/out, server time, status)
  functions/room-qr/              admin-only signed QR minting (Tier A static / Tier B rotating)
  functions/auto-close-dangling/  end-of-day close of forgotten time-ins
  functions/_shared/              HMAC, geo (haversine), CORS helpers
  seed.sql                        sample rooms
src/
  lib/            supabase client, geo, face service interface + face-api provider
  context/        AuthContext (role resolution: admin / super_admin / teacher)
  components/     Layout, camera hook, UI primitives, privacy notice
  pages/teacher/  Enrollment, Home, Scan, History
  pages/admin/    Dashboard (realtime), Logs, ReviewQueue, Teachers, Rooms (+QR), Schedules, Reports
```

---

## Setup

### 1. Frontend deps + config
```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

### 2. Face models
Download the face-api.js weights into `public/models/` — see
[`public/models/README.md`](public/models/README.md).

### 3. Supabase
```bash
# local
supabase start
supabase db reset          # applies migrations 0001, 0002 + seed
supabase functions serve   # record-scan, room-qr, auto-close-dangling

# or hosted
supabase link --project-ref <ref>
supabase db push
supabase functions deploy record-scan room-qr auto-close-dangling
```
The Edge Functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (injected
automatically on Supabase). Optional: set `GEOFENCE_FLAG_METERS` (default 75).

### 4. Run
```bash
npm run dev        # http://localhost:5173
```

> Camera + geolocation need a secure context. `localhost` is treated as secure;
> on a phone over LAN use an HTTPS tunnel (e.g. `vite --https` or ngrok).

---

## First run — create accounts

Auth users and their role rows are linked by `id` / email:

- **Admin:** create a user in Supabase Auth, then
  `insert into admins (id, full_name, role) values ('<auth-user-id>', 'HR Office', 'admin');`
- **Teacher:** add the record in the admin **Teachers** page, then invite an
  auth user with the same email; link it with
  `update teachers set auth_user_id = '<auth-user-id>' where email = '<email>';`

A teacher must complete **enrollment** (consent + face capture) before scanning.

---

## How the scan is trusted (spec §8, §9)

The client does the ergonomic work (scan QR, run liveness, compute a 1:1 match
score locally so the face template stays on the phone) and sends the result to
`record-scan`. The **server** is the source of truth and re-derives everything
security-sensitive:

- verifies the QR HMAC against the room's `qr_secret` (never exposed to clients)
  and, for rotating QR, checks expiry;
- requires the caller to be an active, enrolled, consented teacher;
- decides `in` vs `out` from the teacher's last open event in that room;
- stamps `scanned_at` with Postgres `now()`;
- computes geofence distance as a **soft flag** only;
- sets `status`: `verified`, or `flagged` (soft face/liveness/geo failure), or
  `override` (manual path) — flagged/override land in the admin **Review queue**.

RLS keeps teachers to their own rows; `qr_secret` and `face_template` columns
are revoked from client roles and only reachable via the service role or the
narrow `get_my_face_template()` / `complete_enrollment()` RPCs.

---

## Build order status (spec §12)

- **Phase 1 — foundation & basic scan:** schema, RLS, auth/roles, room + signed
  QR management with printable sheet, scan flow, server timestamps + auto in/out,
  admin log view. ✅
- **Phase 2 — face verification:** consent + reference capture + template store;
  liveness prompt + 1:1 match; retry + override path. ✅
- **Phase 3 — monitoring:** geofence soft-flag, schedule management + late/early
  flagging, realtime occupancy dashboard, review queue. ✅
- **Phase 4 — reporting & compliance:** CSV export per pay period, consent audit
  trail, biometric-deletion tooling, privacy notice, end-of-day auto-close. ✅
- **Later / optional:** Tier B rotating QR (endpoint supports it via `ttlSeconds`),
  native app, passive liveness upgrade.

## Privacy & compliance (RA 10173)

Face data is sensitive personal information. This build enforces blocking opt-in
consent (audited in `consent_records` with policy version), prefers storing a
face **template** over raw photos, keeps any raw images in a private admin-only
Storage bucket, restricts biometric access via RLS, provides a per-teacher
biometric-deletion action for offboarding, and shows a privacy notice at
enrollment. See the notice text in `src/components/PrivacyNotice.jsx`.
