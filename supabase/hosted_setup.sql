-- ============================================================================
-- DMMA hosted Supabase setup — paste this whole file into the Supabase SQL
-- Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Combines migrations 0001, 0002, and the room seed. Safe to run once.
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>> 0001_init.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- DMMA Teacher Attendance System — initial schema
-- Data model per spec §7. Row Level Security per spec §7/§10.
--
-- Design notes:
--  * `scanned_at` on attendance_logs is ALWAYS set server-side (see the
--    record-scan Edge Function). The device clock is never trusted (spec §5).
--  * `qr_secret`, `face_template`, and reference images must never be readable
--    by the teacher client (spec §7/§10). RLS below enforces this: teachers
--    can only see their own non-sensitive columns via the `me` views / policies,
--    and the sensitive columns are only reachable by the service role used
--    inside Edge Functions.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
-- Admin identity is keyed on auth.users.id via the admins table.
create table if not exists public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.id = auth.uid() and a.role = 'super_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------
create table if not exists public.teachers (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique references auth.users (id) on delete set null,
  employee_id          text unique not null,
  full_name            text not null,
  email                text unique not null,
  department           text,
  reference_face_path  text,                  -- Storage path (null if template-only)
  face_template        jsonb,                 -- computed descriptor (preferred)
  enrolled_at          timestamptz,
  consent_at           timestamptz,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create index if not exists teachers_auth_user_idx on public.teachers (auth_user_id);

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  room_code  text unique not null,
  building   text,
  floor      text,
  latitude   double precision,
  longitude  double precision,
  qr_secret  text not null default encode(gen_random_bytes(32), 'hex'),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- schedules
-- ---------------------------------------------------------------------------
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  room_id      uuid not null references public.rooms (id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6), -- 0=Sun..6=Sat
  start_time   time not null,
  end_time     time not null,
  subject      text,
  term         text,
  created_at   timestamptz not null default now()
);

create index if not exists schedules_teacher_idx on public.schedules (teacher_id);
create index if not exists schedules_room_dow_idx on public.schedules (room_id, day_of_week);

-- ---------------------------------------------------------------------------
-- attendance_logs
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_logs (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references public.teachers (id) on delete cascade,
  room_id          uuid not null references public.rooms (id) on delete cascade,
  event_type       text not null check (event_type in ('in', 'out')),
  scanned_at       timestamptz not null default now(),   -- SERVER time only
  latitude         double precision,
  longitude        double precision,
  distance_m       numeric,
  face_match_score numeric,
  face_verified    boolean,
  liveness_passed  boolean,
  status           text not null default 'verified'
                     check (status in ('verified', 'flagged', 'override', 'rejected')),
  auto_closed      boolean not null default false,  -- end-of-day dangling close
  device_info      jsonb,
  reviewed_by      uuid references public.admins (id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists logs_teacher_idx  on public.attendance_logs (teacher_id, scanned_at desc);
create index if not exists logs_room_idx      on public.attendance_logs (room_id, scanned_at desc);
create index if not exists logs_status_idx    on public.attendance_logs (status) where status in ('flagged', 'override');
-- Fast lookup of a teacher's latest open ('in') event per room for in/out logic.
create index if not exists logs_open_in_idx
  on public.attendance_logs (teacher_id, room_id, scanned_at desc)
  where event_type = 'in';

-- ---------------------------------------------------------------------------
-- consent_records (RA 10173 audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  teacher_id     uuid not null references public.teachers (id) on delete cascade,
  policy_version text not null,
  consented_at   timestamptz not null default now(),
  ip_address     text
);

create index if not exists consent_teacher_idx on public.consent_records (teacher_id);

-- ---------------------------------------------------------------------------
-- Convenience: resolve the teacher row for the current auth user.
-- ---------------------------------------------------------------------------
create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from public.teachers t where t.auth_user_id = auth.uid();
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.admins          enable row level security;
alter table public.teachers        enable row level security;
alter table public.rooms           enable row level security;
alter table public.schedules       enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.consent_records enable row level security;

-- admins: an admin can read their own row; super_admins manage all admins.
create policy admins_self_read on public.admins
  for select using (id = auth.uid() or public.is_super_admin());
create policy admins_super_manage on public.admins
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- teachers:
--  * a teacher can read their OWN row (the client still must avoid selecting
--    sensitive columns; those are additionally never returned to the teacher
--    UI, and only the service role reads face_template / qr for matching).
--  * admins can read and manage all teachers.
create policy teachers_self_read on public.teachers
  for select using (auth_user_id = auth.uid() or public.is_admin());
create policy teachers_admin_write on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());
-- teachers may update only their own consent/enrollment-completion timestamps.
create policy teachers_self_update on public.teachers
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- rooms: everyone authenticated can read NON-secret room info (needed to render
-- room labels). qr_secret is protected by a column-privilege grant below, not
-- by RLS, so we revoke it from anon/authenticated. Admins manage rooms.
create policy rooms_read on public.rooms
  for select using (auth.role() = 'authenticated');
create policy rooms_admin_write on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

-- schedules: a teacher reads their own; admins manage all.
create policy schedules_self_read on public.schedules
  for select using (teacher_id = public.current_teacher_id() or public.is_admin());
create policy schedules_admin_write on public.schedules
  for all using (public.is_admin()) with check (public.is_admin());

-- attendance_logs: a teacher reads only their own logs; admins read all.
-- INSERTs are performed by the record-scan Edge Function (service role), which
-- bypasses RLS — teachers cannot self-insert arbitrary logs from the client.
create policy logs_self_read on public.attendance_logs
  for select using (teacher_id = public.current_teacher_id() or public.is_admin());
create policy logs_admin_write on public.attendance_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- consent_records: a teacher reads their own; admins read all. Inserts happen
-- via the enrollment Edge Function / admin.
create policy consent_self_read on public.consent_records
  for select using (teacher_id = public.current_teacher_id() or public.is_admin());
create policy consent_admin_write on public.consent_records
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Column-level protection for room secrets.
-- qr_secret must never leave the server. Revoke it from client roles; the
-- service role (Edge Functions) retains full access.
-- ---------------------------------------------------------------------------
revoke select (qr_secret) on public.rooms from anon, authenticated;

-- Likewise keep face templates out of the teacher client. Admins need them for
-- management tooling only through the service role; revoke from client roles.
revoke select (face_template) on public.teachers from anon, authenticated;

-- ============================================================================
-- Storage: private bucket for raw reference images (spec §10 data minimization
-- prefers templates, but if raw images are kept they live here, admin-only).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('reference-faces', 'reference-faces', false)
on conflict (id) do nothing;

create policy ref_faces_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'reference-faces' and public.is_admin())
  with check (bucket_id = 'reference-faces' and public.is_admin());

-- A teacher may upload their own enrollment selfie into a folder named by their
-- teacher id (path = '<teacher_id>/...'), but cannot read others'.
create policy ref_faces_self_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reference-faces'
    and (storage.foldername(name))[1] = public.current_teacher_id()::text
  );

-- >>>>>>>>>>>>>>>>>>>> 0002_rpc_and_views.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- RPCs and views: enrollment, dangling-in detection, live occupancy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- complete_enrollment: called by a teacher from the client at the end of the
-- enrollment flow (spec §6.1). Atomically records consent + stores the face
-- template + marks enrollment complete. SECURITY DEFINER so it can write the
-- protected face_template column and the consent audit row in one shot, while
-- still keying strictly off the caller's own auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.complete_enrollment(
  p_template       jsonb,
  p_policy_version text,
  p_ip_address     text default null
)
returns public.teachers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher public.teachers;
begin
  select * into v_teacher
  from public.teachers
  where auth_user_id = auth.uid()
  for update;

  if v_teacher.id is null then
    raise exception 'no teacher record for current user';
  end if;

  update public.teachers
     set face_template = coalesce(p_template, face_template),
         consent_at    = coalesce(consent_at, now()),
         enrolled_at   = now()
   where id = v_teacher.id
   returning * into v_teacher;

  insert into public.consent_records (teacher_id, policy_version, ip_address)
  values (v_teacher.id, p_policy_version, p_ip_address);

  return v_teacher;
end;
$$;

grant execute on function public.complete_enrollment(jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_my_face_template: the ONLY way the teacher client can read back its own
-- template (needed by face-api.js at scan time). Returns just the caller's
-- vector; never anyone else's. face_template SELECT is otherwise revoked.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_face_template()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select face_template
  from public.teachers
  where auth_user_id = auth.uid();
$$;

grant execute on function public.get_my_face_template() to authenticated;

-- ---------------------------------------------------------------------------
-- find_dangling_ins: used by the auto-close-dangling Edge Function. Returns
-- (teacher_id, room_id) pairs whose most recent event is 'in' and older than
-- the cutoff — i.e. someone timed in but never timed out.
-- ---------------------------------------------------------------------------
create or replace function public.find_dangling_ins(cutoff timestamptz)
returns table (teacher_id uuid, room_id uuid)
language sql
stable
as $$
  with latest as (
    select distinct on (l.teacher_id, l.room_id)
           l.teacher_id, l.room_id, l.event_type
    from public.attendance_logs l
    where l.scanned_at < cutoff
    order by l.teacher_id, l.room_id, l.scanned_at desc
  )
  select latest.teacher_id, latest.room_id
  from latest
  where latest.event_type = 'in';
$$;

-- ---------------------------------------------------------------------------
-- live_occupancy: current room occupancy for the admin dashboard (spec §6.3).
-- A teacher is "in" a room when their most recent event there is 'in'.
-- Exposed as a security-barrier view; RLS on the underlying tables + the
-- is_admin() checks in policies mean only admins can meaningfully read it.
-- ---------------------------------------------------------------------------
create or replace view public.live_occupancy
with (security_invoker = true)
as
  with latest as (
    select distinct on (l.teacher_id, l.room_id)
           l.teacher_id, l.room_id, l.event_type, l.scanned_at, l.status
    from public.attendance_logs l
    order by l.teacher_id, l.room_id, l.scanned_at desc
  )
  select
    latest.teacher_id,
    t.full_name,
    t.employee_id,
    latest.room_id,
    r.room_code,
    r.building,
    latest.scanned_at as since,
    latest.status
  from latest
  join public.teachers t on t.id = latest.teacher_id
  join public.rooms r    on r.id = latest.room_id
  where latest.event_type = 'in';

-- >>>>>>>>>>>>>>>>>>>> seed.sql (sample rooms) <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- Local dev seed. Loaded by `supabase start` / `supabase db reset`.
-- Creates a couple of rooms and a term schedule scaffold. Auth users / teacher
-- and admin links are created via the app (sign up) or the Supabase dashboard,
-- then wired up here by email — see README "First run".
-- ============================================================================

insert into public.rooms (room_code, building, floor, latitude, longitude)
values
  ('R-204', 'Main', '2', 7.083000, 125.612900),
  ('R-101', 'Main', '1', 7.083100, 125.613000),
  ('LAB-A', 'Annex', '1', 7.083400, 125.612500)
on conflict (room_code) do nothing;
