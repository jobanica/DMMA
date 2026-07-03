-- ============================================================================
-- Explicit privilege grants for the API roles.
--
-- RLS policies only take effect once the role also holds the underlying table
-- privilege. Relying on Supabase's default-privilege bootstrap is fragile
-- (tables created through the Management API / CLI did NOT receive the
-- anon/authenticated grants), so grant them explicitly here. Row access stays
-- governed by the RLS policies in 0001; these grants just open the door.
--
-- Sensitive columns remain protected: rooms/teachers get SELECT only on their
-- non-sensitive columns (qr_secret / face_template stay server-only).
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- service_role (Edge Functions) needs unrestricted access; it bypasses RLS.
grant all on all tables in schema public to service_role;
grant execute on all routines in schema public to service_role;

-- Tables with no sensitive columns: full DML, gated by RLS.
grant select, insert, update, delete
  on public.admins, public.schedules, public.attendance_logs, public.consent_records
  to anon, authenticated;

-- rooms: writes gated by RLS; SELECT limited to non-sensitive columns.
grant insert, update, delete on public.rooms to anon, authenticated;
grant select (id, room_code, building, floor, latitude, longitude, active, created_at)
  on public.rooms to anon, authenticated;

-- teachers: writes gated by RLS; SELECT limited to non-sensitive columns.
grant insert, update, delete on public.teachers to anon, authenticated;
grant select (id, auth_user_id, employee_id, full_name, email, department,
              reference_face_path, enrolled_at, consent_at, active, created_at)
  on public.teachers to anon, authenticated;

-- Policy helper + RPC functions must be executable by the client roles.
grant execute on all routines in schema public to anon, authenticated;

-- The live_occupancy view (security_invoker) — admins read it via RLS on the
-- underlying tables; the view object itself still needs a SELECT grant.
grant select on public.live_occupancy to anon, authenticated;
