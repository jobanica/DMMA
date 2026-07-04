-- ============================================================================
-- Add an optional phone number to teachers (contact info).
-- teachers SELECT is column-restricted (see 0004), so expose the new column to
-- the client roles. INSERT/UPDATE are already table-level granted.
-- ============================================================================

alter table public.teachers add column if not exists phone text;

grant select (phone) on public.teachers to anon, authenticated;
