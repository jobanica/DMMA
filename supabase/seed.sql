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
