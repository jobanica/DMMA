-- ============================================================================
-- Fix: make the sensitive-column protection effective on databases that were
-- created with the original 0001 (whose bare `revoke select (col)` was a no-op
-- while table-level SELECT remained). Idempotent — safe to re-run and harmless
-- on fresh databases where 0001 already applies the corrected pattern.
--
-- Without this, any authenticated user could read rooms.qr_secret (and forge
-- valid room QR tokens, defeating the anti-proxy control) or teachers.face_template.
-- ============================================================================

revoke select on public.rooms from anon, authenticated;
grant select (id, room_code, building, floor, latitude, longitude, active, created_at)
  on public.rooms to anon, authenticated;

revoke select on public.teachers from anon, authenticated;
grant select (id, auth_user_id, employee_id, full_name, email, department,
              reference_face_path, enrolled_at, consent_at, active, created_at)
  on public.teachers to anon, authenticated;
