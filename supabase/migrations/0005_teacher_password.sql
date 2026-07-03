-- ============================================================================
-- Teacher account provisioning: admins create a teacher WITH a temporary
-- password (via the create-teacher Edge Function, which makes the auth user).
-- On first sign-in the teacher is forced to set a new password; this flag
-- tracks that state and is cleared once they change it.
-- ============================================================================

alter table public.teachers
  add column if not exists must_change_password boolean not null default false;

-- teachers table SELECT is column-restricted (see 0004); expose the new column
-- to the client roles. UPDATE is already table-level granted, so a teacher can
-- clear their own flag under the teachers_self_update RLS policy.
grant select (must_change_password) on public.teachers to anon, authenticated;
